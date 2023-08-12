// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { buildGraph } from "./engine/parsing/parsing";
import * as fs from "fs";
import * as path from "path";
import { FunctionGraph, FunctionNode } from "./engine/graphs/function_graph";
import { getEmbedding, getEmbeddingsBatch } from "./engine/openai";
import { Embedding, EmbeddingMetadata, dot } from "./engine/embedding";
import { replaceAll, toPosix } from "./engine/string";

function fileExists(directory: string, fileName: string): boolean {
    const filePath: string = path.join(directory, fileName);

    try {
        const stats: fs.Stats = fs.statSync(filePath);
        return stats.isFile();
    } catch (error) {
        console.log(error);
        return false;
    }
}

async function moveCursorToFunction(functionNode: FunctionNode) {
    console.log(`navigating to ${functionNode.filename}`);
    const document = await vscode.workspace.openTextDocument(functionNode.filename);
    const editor = await vscode.window.showTextDocument(document, undefined, true);

    const position = new vscode.Position(functionNode.definitionLine, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(document.lineAt(functionNode.definitionLine).range);
}

// Define an async function to retrieve the file list
async function getFileList() {
    // Get the workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        // No workspace folders found
        return [];
    }

    const fileList: string[] = [];

    // Iterate over each workspace folder
    for (const folder of workspaceFolders) {
        // Create a glob pattern to match all files
        const filePattern = new vscode.RelativePattern(folder, "**/*");

        // Find all files that match the pattern
        const files = await vscode.workspace.findFiles(filePattern);

        // Add the file paths to the file list
        files.forEach((file) => {
            fileList.push(file.fsPath);
        });
    }

    return fileList;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "metaphrase" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand("metaphrase.helloWorld", () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage("Hello World from metaphrase!");
    });

    const buildContext = async (): Promise<FunctionGraph> => {
        const paths: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        let rootPath = paths !== undefined ? paths[0].uri.path : "";
        if (process.platform === "win32") {
            rootPath = rootPath.slice(1);
        }

        // convert all paths to posix
        rootPath = replaceAll(rootPath, "\\", "/");

        const fileList = await getFileList();
        let extensionCounts = new Map<string, number>();
        for (const file of fileList) {
            const extension = file.split(".").at(-1);
            if (extension === undefined) {
                continue;
            }

            const currentValue = extensionCounts.get(extension);
            if (currentValue !== undefined) {
                extensionCounts.set(extension, currentValue + 1);
            } else {
                extensionCounts.set(extension, 1);
            }
        }

        let mostCommonExtension = "";
        let highestCount = 0;
        extensionCounts.forEach((value, key) => {
            if (value > highestCount) {
                mostCommonExtension = key;
                highestCount = value;
            }
        });

        const verbose = 1;
        const language = mostCommonExtension;

        // look for metaphrase.json
        let functionGraph: FunctionGraph = new FunctionGraph("");
        if (fileExists(rootPath, "metaphrase.json")) {
            console.log("existing context detected, loading metaphrase.json");
            functionGraph = new FunctionGraph(rootPath);
            functionGraph.deserialize(rootPath + "/metaphrase.json");
        } else {
            console.log("no existing context found, building new context");
            try {
                functionGraph = buildGraph(rootPath, verbose, language);
            } catch (e) {
                console.log(e);
            }
            console.log("graph built; serializing to " + rootPath + "/metaphrase.json");

            functionGraph.serialize(rootPath + "/metaphrase.json");
        }

        functionGraph.printCount();
        vscode.window.showInformationMessage(`catalogued ${functionGraph.getCount()} functions`);

        return functionGraph;
    };

    const buildContextCommand = vscode.commands.registerCommand("metaphrase.buildContext", buildContext);
    const generateEmbeddings = vscode.commands.registerCommand("metaphrase.generateEmbeddings", async () => {
        const functionGraph = await buildContext();
        functionGraph.repository = toPosix(functionGraph.repository);

        const embeddingsPath = functionGraph.repository + "/.embeddings";
        fs.mkdir(embeddingsPath, (err) => {
            if (err) {
                console.error("Error creating directory:", err);
            } else {
                console.log("Directory created successfully.");
            }
        });

        const batchSize = 50;
        let batchMap = {} as any;

        const entries = Object.entries(functionGraph.functions);

        let tokenCount = 0;
        let batchNumber = 0;
        for (let i = 0; i < entries.length; i++, batchNumber++) {
            const batch = [] as [string, string][];
            for (let j = 0; i < entries.length && j < batchSize; j++, i++) {
                batch.push([toPosix(entries[i][0]), entries[i][1].definition.join("\n")]);
            }

            const [tokens, embeddings] = await getEmbeddingsBatch(batch);

            const obj = {} as any;
            for (let j = 0; j < batch.length; j++) {
                obj[batch[j][0]] = embeddings[j];

                batchMap[batch[j][0]] = {
                    batchNumber,
                    index: j,
                };
            }

            const filename = batchNumber + ".json";
            fs.writeFileSync(embeddingsPath + "/" + filename, JSON.stringify(obj), {
                flag: "w",
            });

            tokenCount += tokens;
            console.log(`${i + 1} / ${entries.length} embeddings saved. ${tokenCount}`);
        }

        const batchMeta = {
            batchSize,
            batchMapping: batchMap,
        } as EmbeddingMetadata;

        fs.writeFileSync(embeddingsPath + "/batchMeta.json", JSON.stringify(batchMeta), {
            flag: "w",
        });
    });

    const queryRepository = vscode.commands.registerCommand("metaphrase.queryRepository", async () => {
        const prompt = await vscode.window.showInputBox({
            prompt: "What do you want to know?",
            placeHolder: "Where do we handle authentication?",
        });

        const functionGraph = await buildContext();
        const embeddings = {} as any;

        try {
            const files = await fs.promises.readdir(functionGraph.repository + "/.embeddings");

            for (const file of files) {
                const filePath = path.join(functionGraph.repository + "/.embeddings", file);
                const data = await fs.promises.readFile(filePath, "utf8");

                try {
                    const jsonObject = JSON.parse(data);
                    Object.assign(embeddings, jsonObject);
                } catch (parseError) {
                    console.error("Error parsing JSON:", parseError);
                }
            }
        } catch (err) {
            console.error("Error reading directory:", err);
        }

        if (prompt) {
            vscode.window.showInformationMessage(`Prompting with: ${prompt}`);
            const [success, queryEmbed] = await getEmbedding(prompt);

            let mostSimilarFunction: FunctionNode = {
                filename: "",
                signature: "",
                name: "",
                definition: [],
                definitionLine: 0,
                declarationLine: 0,
            };

            let highestSimilarity = 0;

            if (success) {
                for (const [name, embed] of Object.entries(embeddings)) {
                    if (name.includes("batch")) {
                        continue;
                    }

                    try {
                        const score = dot(embed as Embedding, queryEmbed);

                        if (score > highestSimilarity) {
                            highestSimilarity = score;
                            mostSimilarFunction = functionGraph.functions[name];
                        }
                    } catch (error) {
                        console.log(error);
                        console.log(embed);
                    }
                }

                vscode.window.showInformationMessage(
                    `Most similar function is ${mostSimilarFunction.name} with similarity ${highestSimilarity}`
                );

                moveCursorToFunction(mostSimilarFunction);
            } else {
                vscode.window.showInformationMessage("Error getting query embedding.");
            }
        } else {
            vscode.window.showWarningMessage("No input provided.");
        }
    });

    const showFunctions = vscode.commands.registerCommand("metaphrase.showFunctions", async () => {
        const functionGraph = await buildContext();
        let functions: string[] = [];
        for (const f in functionGraph.functions) {
            functions.push(f);
        }

        const message = functions.join("\n");
        vscode.window.showInformationMessage(message);
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(buildContextCommand);
    context.subscriptions.push(generateEmbeddings);
    context.subscriptions.push(queryRepository);
    context.subscriptions.push(showFunctions);
}

// This method is called when your extension is deactivated
export function deactivate() {}
