import * as graphs from "../../graphs/function_graph";

import * as fs from "fs";
import * as path from "path";
import { filenameFromPath, getLines } from "../parse_util";
import { BracedScopeManager } from "../../scope_managers";
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
    private scopeManager: BracedScopeManager;

    private keywords: string[] = ["function", "if", "while", "for", "class"];

    // these could probably be better
    private classRegex: RegExp = /class\s[\w\d]*(\s*[\w\d]*\s*)*{/;
    private functionRegex: RegExp = /function \w*\((\s*[\w\d]*:(\s*\w*\d*.*\s*))*\)(\s*:(\s*\w*\d*.*\s*))*{/;
    private classFunctionRegex: RegExp = /\w*\((\s*[\w\d]*:(\s*\w*\d*.*\s*))*\)(\s*:(\s*\w*\d*.*\s*))*\s*{/;

    constructor(toBeParsed: string[]) {
        this.lines = toBeParsed;
        this.scopeManager = new BracedScopeManager();
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
        const hardLimit = 50;

        let cursor = this.cursor;
        let lineNumber = this.line;
        let distance = 0;

        let buffer = "";
        while (lineNumber > -1 && distance < hardLimit) {
            while (cursor > -1 && distance < hardLimit) {
                buffer = this.lines[lineNumber][cursor] + buffer;

                if (buffer.includes("function ")) {
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

        let currentFunction = new Function();
        const functionCallback = () => {
            currentFunction.definition.unshift(currentFunction.signature);
            currentFunction.signature = currentFunction.signature.slice(0, currentFunction.signature.length - 1).trim();

            if (this.scopeManager.currentClass !== "") {
                currentFunction.name = this.scopeManager.currentClass + "." + currentFunction.name;
            }

            functions.push(currentFunction);
            currentFunction = new Function();
        };

        this.scopeManager.resetFunctionCallback = functionCallback;

        while (!this.eofCheck()) {
            const line = this.lines[this.line];
            const c = line[this.cursor];

            this.scopeManager.push(c);

            if (!(this.scopeManager.inQuote() || this.scopeManager.inComment())) {
                if (currentFunction !== null && this.scopeManager.inFunction) {
                    // continue getting the definition
                    currentFunction.definition.push(line);

                    for (const char of line) {
                        this.scopeManager.push(char);
                    }

                    this.nextLine();
                    continue;
                } else {
                    if (this.buffer.includes("class")) {
                        // if we find the word `class`, find the next open bracket `{`
                        // and check if it's an actual class definition
                        if (!this.buffer.endsWith("{")) {
                            this.findTargetWithUpdate("{");
                        }

                        const match = this.classRegex.test(this.buffer);
                        if (match) {
                            const index = Math.max(0, this.buffer.indexOf("class "));
                            this.buffer = this.buffer.substring(index, this.buffer.length);
                            const className = this.buffer.split(" ")[1];

                            this.scopeManager.setClass(className);

                            this.buffer = "";
                            this.nextLine();
                            continue;
                        }
                    } else if (c === "(") {
                        if (this.scopeManager.inClass) {
                            // find the start of the suspected function
                            this.nextCharacter();
                            this.buffer += c;
                            this.findTargetWithUpdate("{");

                            // does it fit the regex? if yes, start logging the definition
                            const match = this.classFunctionRegex.exec(this.buffer);
                            if (match !== null) {
                                const functionSignature = this.buffer.slice(match.index, this.buffer.length);
                                const functionName = functionSignature.split("(")[0];

                                this.scopeManager.setFunction(functionSignature);
                                currentFunction.signature = functionSignature;
                                currentFunction.name = functionName;

                                this.buffer = "";
                                this.nextLine();
                                continue;
                            }
                        } else {
                            // look for function keyword
                            // if it exists, is this a function signature?
                            const functionKeyword = this.findFunctionPrepend();

                            this.buffer = functionKeyword;
                            this.nextCharacter();
                            this.findTargetWithUpdate("{");

                            // if it fits, start logging the definition
                            const match = this.functionRegex.exec(this.buffer);
                            if (match !== null) {
                                const functionSignature = this.buffer.slice(match.index, this.buffer.length);
                                const functionName = functionSignature.split("(")[0].slice("function ".length);

                                this.scopeManager.setFunction(functionSignature);
                                currentFunction.signature = functionSignature;
                                currentFunction.name = functionName;

                                this.buffer = "";
                                this.nextLine();
                                continue;
                            }
                        }
                    }
                }
            }

            // NOTE: the following line is a (hopefully) guarantee that this.buffer.length >= 1
            this.buffer += c;
            if (this.buffer.endsWith(" ")) {
                this.buffer = "";
            }

            this.nextCharacter();
        }
        return functions;
    }
}

function getSources(rootPath: string): string[] {
    const sourceRegex: RegExp = /.*\.ts$/;

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
