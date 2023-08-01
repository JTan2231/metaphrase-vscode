import * as graphs from "../../graphs/function_graph";

import * as fs from "fs";
import * as path from "path";
import { filenameFromPath, getLines } from "../parse_util";
import { PythonScopeManager } from "../../scope_managers";
import { Function } from "../../graphs/function_graph";

// even after the refactor this still feels terrible
// is there something better than OOP here?
// I couldn't find the solution if there is
//
// TODO: another refactor lol
export class TypeScriptParser {
    private buffer: string = "";
    private line: number = 0;
    private cursor: number = 0;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    private EOF: boolean = false;

    private lines: string[];
    private scopeManager: PythonScopeManager;

    private keywords: string[] = ["function", "if", "while", "for", "class"];

    // these could probably be better
    private classRegex: RegExp = /class\s[\w\d]*(\s*[\w\d]*\s*)*{/;
    private functionRegex: RegExp = /function \w*\((\s*[\w\d]*:(\s*\w*\d*.*\s*))*\)(\s*:(\s*\w*\d*.*\s*))*{/;
    private classFunctionRegex: RegExp = /\w*\((\s*[\w\d]*:(\s*\w*\d*.*\s*))*\)(\s*:(\s*\w*\d*.*\s*))*\s*{/;

    constructor(toBeParsed: string[]) {
        this.lines = toBeParsed;
        this.scopeManager = new PythonScopeManager();
    }

    eofCheck() {
        if (this.EOF) {
            console.log("WARNING: EOF reached");
        }

        return this.EOF;
    }

    // leaves the cursor/line number on the next target character or EOF
    findNextTargetCharacter(target: string): string {
        if (this.eofCheck()) {
            return "";
        }

        let buffer = "";
        while (this.line < this.lines.length) {
            const currentLine = this.lines[this.line];
            while (this.cursor < currentLine.length) {
                const currentChar = currentLine[this.cursor];
                buffer += currentChar;
                this.scopeManager.push(currentChar);

                if (currentChar !== target) {
                    this.cursor++;
                } else {
                    return buffer;
                }
            }

            this.nextLine();
        }

        if (this.line === this.lines.length) {
            console.log(`WARNING: EOF reached, character \`${target}\` not found.`);
            this.EOF = true;
        }

        return buffer;
    }

    // look for the keyword function backward from the current position
    // up to distance `hardLimit`
    findFunctionPrepend(): string {
        const hardLimit = 1000;

        let cursor = this.cursor;
        let lineNumber = this.line;
        let distance = 0;

        let buffer = "";
        while (lineNumber > -1 && distance < hardLimit) {
            while (cursor > -1 && distance < hardLimit) {
                buffer = this.lines[lineNumber][cursor] + buffer;

                if (buffer.includes("def ") || buffer.includes("class ")) {
                    return buffer;
                }

                cursor--;
                distance++;
            }

            lineNumber--;
            if (lineNumber > -1) {
                cursor = this.lines[lineNumber].length - 1;
            }
        }

        return buffer;
    }

    keywordMatch(): string {
        for (const keyword of this.keywords) {
            if (this.buffer.includes(keyword)) {
                return keyword;
            }
        }

        return "";
    }

    nextLine() {
        this.line++;
        this.cursor = 0;

        this.EOF = this.line >= this.lines.length;
        this.scopeManager.lineBreak();
    }

    nextCharacter() {
        if (this.eofCheck()) {
            return;
        }

        if (this.cursor + 1 >= this.lines[this.line].length) {
            this.nextLine();
        } else {
            this.cursor++;
        }
    }

    findTargetWithUpdate(target: string) {
        const searchBuffer = this.findNextTargetCharacter(target);
        this.buffer += searchBuffer;
    }

    parse() {
        const functions: Function[] = [];

        let currentFunction: Function | undefined;
        const functionCallback = () => {
            if (currentFunction) {
                currentFunction.definition.unshift(currentFunction.signature);
                currentFunction.signature = currentFunction.signature
                    .slice(0, currentFunction.signature.length - 1)
                    .trim();

                if (this.scopeManager.currentClass !== "") {
                    currentFunction.name = this.scopeManager.currentClass + "." + currentFunction.name;
                }

                currentFunction.definition = currentFunction.definition.slice(0, currentFunction.definition.length - 1);

                functions.push(currentFunction);
                currentFunction = undefined;
            }
        };

        const newScopeCallback = () => {
            const prepend = this.findFunctionPrepend();

            // did we find a new function?
            if (
                (prepend.includes("def ") || prepend.includes("class ")) &&
                !(prepend.includes("if ") || prepend.includes("while ") || prepend.includes("for "))
            ) {
                const functionSignature = prepend;
                const functionName = functionSignature.split(" ")[1].split(":")[0].split("(")[0];

                this.scopeManager.addNamedScope(functionName);

                // don't bother logging nested functions
                if (currentFunction === undefined && !prepend.includes("class ")) {
                    currentFunction = new Function();
                    currentFunction.signature = functionSignature;
                    currentFunction.name = this.scopeManager.getNamedScope();

                    this.scopeManager.setFunction(functionSignature);
                }
            }
        };

        this.scopeManager.resetFunctionCallback = functionCallback;
        this.scopeManager.newScopeCallback = newScopeCallback;

        while (!this.eofCheck()) {
            const line = this.lines[this.line];
            const c = line[this.cursor];

            if (currentFunction) {
                currentFunction.definition.push(line);

                for (const char of line) {
                    this.scopeManager.push(char);
                }

                this.nextLine();
                continue;
            }

            this.scopeManager.push(c);

            // do the parse

            // NOTE: the following line is a (hopefully) guarantee that this.buffer.length >= 1
            this.buffer += c;
            if (this.buffer.endsWith(" ")) {
                this.buffer = "";
            }

            this.nextCharacter();
        }

        if (currentFunction) {
            functionCallback();
        }

        return functions;
    }
}

function getSources(rootPath: string): string[] {
    const sourceRegex: RegExp = /.*\.py$/;

    const sources: string[] = [];

    function traverseDirectory(directoryPath: string) {
        const dirents: fs.Dirent[] = fs.readdirSync(directoryPath, {
            withFileTypes: true
        });

        for (const dirent of dirents) {
            const filePath: string = path.join(directoryPath, dirent.name);

            if (dirent.isFile()) {
                if (sourceRegex.test(dirent.name) && !dirent.name.includes(".test.")) {
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

function processFile(functionGraph: graphs.FunctionGraph, filepath: string, verbose: number): void {
    const filename: string = filenameFromPath(filepath);
    const lines: string[] = getLines(filepath);

    let parser = new TypeScriptParser(lines);
    const functions = parser.parse();

    // Add the functions to the graph
    for (const f of functions) {
        f.filename = filename;
        if (verbose > 1) {
            console.log("  - processing function: " + f.name);
        }

        functionGraph.addFunction(f);
    }
}

export function buildGraphs(rootPath: string, verbose: number): graphs.FunctionGraph {
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
