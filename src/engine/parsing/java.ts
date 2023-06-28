import * as graphs from "../graphs/function_graph";

import * as fs from "fs";
import * as path from "path";
import { Embedding } from "../embedding";
import { BraceStack, ClassBraceStack } from "../brace_stack";
import {
    filenameFromPath,
    findAfterIndex,
    getFunctionName,
    getLines,
    isLetter,
} from "./parse_util";

function getSources(rootPath: string): string[] {
    const sourceRegex: RegExp = /.*\.java$/;

    const sources: string[] = [];

    function traverseDirectory(directoryPath: string) {
        const dirents: fs.Dirent[] = fs.readdirSync(directoryPath, {
            withFileTypes: true,
        });

        for (const dirent of dirents) {
            const filePath: string = path.join(directoryPath, dirent.name);

            if (dirent.isFile()) {
                if (
                    sourceRegex.test(dirent.name) &&
                    !dirent.name.includes(".test.")
                ) {
                    sources.push(filePath);
                }
            } else if (dirent.isDirectory()) {
                traverseDirectory(filePath);
            }
        }
    }

    traverseDirectory(rootPath);

    return sources;
}

function processFile(
    functionGraph: graphs.FunctionGraph,
    filepath: string,
    verbose: number
): void {
    const filename: string = filenameFromPath(filepath);
    const lines: string[] = getLines(filepath);

    const functions: graphs.Function[] = [];

    const typeNames: RegExp = /public|private|protected/;
    const branchingNames: RegExp = /if|while|for/;

    let l: number = 0;
    let classBraceStack = new ClassBraceStack("{", "}");
    while (l < lines.length) {
        let line: string = lines[l];

        let words: string = "";
        for (let i = 0; i < line.length; i++) {
            const c: string = line[i];
            words += c;
            const n: number = words.length;
            const m: number = Math.max(n - 2, 0);

            // Ignore comments
            if (words.slice(m).includes("/*")) {
                words = words.slice(m);
                let commentEnd: boolean = false;
                while (l < lines.length && !commentEnd) {
                    commentEnd = lines[l].includes("*/");
                    l++;
                }

                if (commentEnd) {
                    l--;
                }

                break;
            } else if (words.slice(m).includes("//")) {
                words = "";
                continue;
            }

            if (
                classBraceStack.className.length === 0 &&
                words.includes("class ")
            ) {
                while (i < line.length && line[i] !== "{") {
                    words += line[i];
                    classBraceStack.className += line[i];
                    i++;
                }

                if (line[i - 1] !== "{") {
                    while (i < line.length && line[i] !== "{") {
                        i++;
                    }

                    if (line[i] === "{") {
                        classBraceStack.evalPush(line[i]);
                    }
                }

                if (classBraceStack.className.includes("extends")) {
                    classBraceStack.className =
                        classBraceStack.className.split("extends")[0];
                } else if (classBraceStack.className.includes("implements")) {
                    classBraceStack.className =
                        classBraceStack.className.split("implements")[0];
                }

                classBraceStack.className = classBraceStack.className.trim();
            }

            // Potential function call/definition
            if (words[n - 1] === "(") {
                if (n > 1 && isLetter(words[n - 2])) {
                    // Get the entire function signature/call with arguments
                    const bs = new BraceStack("(", ")");
                    bs.evalPush(words[n - 1]);

                    const wordsParentheseIndex: number = words.length - 1;

                    let idx: number = i + 1;
                    let cl: number = l;
                    while (cl < lines.length && bs.len() > 0) {
                        while (bs.len() > 0 && idx < lines[cl].length) {
                            const nc: string = lines[cl][idx];
                            words += nc;

                            bs.evalPush(lines[cl][idx]);

                            idx++;
                        }

                        if (bs.len() === 0) {
                            break;
                        } else {
                            cl++;
                            idx = 0;
                        }
                    }

                    // Cut off everything else in the line
                    idx = wordsParentheseIndex - 1;
                    let rwi: string = words[idx];
                    while (
                        idx > 0 &&
                        (isLetter(rwi) || rwi === "_" || rwi === " ")
                    ) {
                        idx--;
                        rwi = words[idx];
                    }

                    if (!isLetter(words[idx])) {
                        idx++;
                    }

                    words = words.slice(idx);
                    words = words.trim();

                    let isDefinition: boolean = false;
                    let isDeclaration: boolean = false;
                    const def: string[] = [];
                    // Is it a function declaration/definition?
                    const hasFunctionKeyword = typeNames.test(
                        words.slice(0, words.indexOf("("))
                    );

                    if (
                        hasFunctionKeyword ||
                        (!hasFunctionKeyword && classBraceStack.len() > 0)
                    ) {
                        // Find the definition
                        cl = l;
                        while (cl < lines.length) {
                            // Find the starting brace
                            for (let j = 0; j < lines[cl].length; j++) {
                                const dc: string = lines[cl][j];
                                if (dc === "{") {
                                    // Log the definition
                                    isDefinition = true;
                                    const dbs: BraceStack = new BraceStack(
                                        "{",
                                        "}"
                                    );
                                    dbs.evalPush(dc);
                                    classBraceStack.evalPush(dc);

                                    let idx: number = j + 1;
                                    while (cl < lines.length && dbs.len() > 0) {
                                        def.push(lines[cl]);
                                        while (
                                            dbs.len() > 0 &&
                                            idx < lines[cl].length
                                        ) {
                                            dbs.evalPush(lines[cl][idx]);
                                            classBraceStack.evalPush(
                                                lines[cl][idx]
                                            );
                                            idx++;
                                        }

                                        cl++;
                                        idx = 0;
                                    }

                                    break;
                                } else if (dc === ";") {
                                    isDeclaration = true;
                                }
                            }

                            if (def.length > 0 || isDeclaration) {
                                break;
                            }

                            cl++;
                        }
                    }

                    // Remove the `return` keyword if it's there
                    if (words.length > 6 && words.slice(0, 7) === "return ") {
                        words = words.slice(7);
                    }

                    const name: string = getFunctionName(words);
                    if (branchingNames.test(name)) {
                        continue;
                    }

                    if (isDefinition) {
                        const signature: string = words;

                        functions.push({
                            filename: filename,
                            signature: signature,
                            name:
                                (classBraceStack.className.length > 0
                                    ? classBraceStack.className + "."
                                    : "") + name,
                            definition: def,
                            definitionLine: l,
                            declarationLine: l,
                            calls: {},
                            embedding: new Embedding([]),
                        });
                    } else {
                        // This is to throw away function declarations
                        // Functions are logged in the graph only if they're defined
                        if (functions.length > 0) {
                            functions[functions.length - 1].calls[name] = true;
                        } else if (verbose > 2) {
                            console.log("    - ignoring declaration: " + name);
                        }
                    }

                    words = "";
                }

                continue;
            }
        }

        l++;
    }

    // Add the functions to the graph
    for (const f of functions) {
        if (verbose > 1) {
            console.log("  - processing function: " + f.name);
        }

        functionGraph.addFunction(f);
    }
}

export function buildGraphs(
    rootPath: string,
    verbose: number
): graphs.FunctionGraph {
    const sources = getSources(rootPath);

    const functionGraph = new graphs.FunctionGraph(rootPath);

    for (const source of sources) {
        if (verbose > 0) {
            console.log("processing file: " + source);
        }

        processFile(functionGraph, source, verbose);
    }

    return functionGraph;
}
