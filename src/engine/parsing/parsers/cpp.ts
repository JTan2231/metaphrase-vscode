import * as graphs from "../../graphs/function_graph";

import * as fs from "fs";
import * as path from "path";
import { BracedScopeManager } from "../../scope_managers";
import { filenameFromPath, findAfterIndex, getLines } from "../parse_util";
import { Function } from "../../graphs/function_graph";
import { toPosix } from "../../string";

export class CParser {
    private buffer: string = "";
    private line: number = 0;
    private cursor: number = 0;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    private EOF: boolean = false;

    private lines: string[];
    private scopeManager: BracedScopeManager;

    private keywords: string[] = ["function", "if", "while", "for", "class"];

    // this regex could probably be better
    private functionRegex: RegExp = /[\w,\*]* [\w>:]*\([\s\S]*\)\s*(const)?\s*{/;

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

    // since the return type can be aliased, just look for the most recent word
    // behind the function name
    findFunctionPrepend(): string {
        const hardLimit = 1000;

        let buffer = "";
        let cursor = this.cursor;
        let line = this.line;
        let distance = 0;

        [cursor, line] = this.decrementCursor(cursor, line);

        const alphanumeric: RegExp = /^[a-z0-9]+$/i;

        const boundsCheck = (distance: number, cursor: number, line: number) => {
            return distance < hardLimit && cursor > -1 && line > -1;
        };

        const currentChar = (line: number, cursor: number) => {
            return this.lines[line][cursor];
        };

        // we're starting at the opening parenthesis of the function name
        // move backward until we find the function name
        // i.e. look for alphanumeric characters
        //
        // note we don't want anything between the parenthesis and function name
        // aside from whitespace
        while (boundsCheck(distance, cursor, line)) {
            if (alphanumeric.test(currentChar(line, cursor)) || currentChar(line, cursor) !== " ") {
                break;
            }

            [cursor, line] = this.decrementCursor(cursor, line);
            distance++;
        }

        if (!alphanumeric.test(currentChar(line, cursor))) {
            return buffer;
        }

        // now that we're at the function name, find the return type
        // by looking for whitespace again,
        // then once more when we find the assumed return type
        while (boundsCheck(distance, cursor, line) && currentChar(line, cursor) !== " ") {
            buffer = currentChar(line, cursor) + buffer;
            [cursor, line] = this.decrementCursor(cursor, line);
            distance++;
        }

        // find the return type
        while (boundsCheck(distance, cursor, line) && !alphanumeric.test(currentChar(line, cursor))) {
            buffer = currentChar(line, cursor) + buffer;
            [cursor, line] = this.decrementCursor(cursor, line);
            distance++;
        }

        // get the return type in the buffer
        while (boundsCheck(distance, cursor, line) && alphanumeric.test(currentChar(line, cursor))) {
            buffer = currentChar(line, cursor) + buffer;
            [cursor, line] = this.decrementCursor(cursor, line);
            distance++;
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

    prevCharacter() {
        if (this.cursor === 0) {
            if (this.line > 0) {
                this.line--;
                this.cursor = this.lines[this.line].length - 1;
            } else {
                this.cursor--;
            }
        }
    }

    decrementCursor(cursor: number, line: number): number[] {
        if (cursor === 0) {
            line--;
            cursor = this.lines[line].length - 1;
        } else {
            cursor--;
        }

        return [cursor, line];
    }

    findTargetWithUpdate(target: string) {
        const searchBuffer = this.findNextTargetCharacter(target);
        this.buffer += searchBuffer;
    }

    parse() {
        const functions: Function[] = [];

        let currentFunction = new Function();
        const functionCallback = () => {
            currentFunction.signature = currentFunction.signature.slice(0, currentFunction.signature.length - 1).trim();

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

                    for (let i = this.cursor; i < line.length; i++) {
                        this.scopeManager.push(line[i]);
                    }

                    this.nextLine();
                    continue;
                } else {
                    if (c === "(") {
                        // look for function keyword
                        // if it exists, is this a function signature?
                        const functionPrepend = this.findFunctionPrepend();

                        this.buffer = functionPrepend;
                        this.findTargetWithUpdate("{");

                        // if it fits, start logging the definition
                        const match = this.functionRegex.exec(this.buffer);
                        if (match !== null) {
                            const functionSignature = this.buffer.slice(match.index, this.buffer.length);
                            const functionName = functionSignature.split(" ")[1].split("(")[0];

                            this.scopeManager.setFunction(functionSignature);

                            currentFunction.definitionLine = this.line;
                            currentFunction.signature = functionSignature;
                            currentFunction.name = functionName;

                            this.buffer = "";
                            this.nextCharacter();
                            continue;
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

function getSources(rootPath: string): [string[], string[]] {
    const sourceRegex: RegExp = /.*\.cpp|\.cc$/;

    const sources: string[] = [];

    function traverseDirectory(directoryPath: string) {
        const dirents: fs.Dirent[] = fs.readdirSync(directoryPath, {
            withFileTypes: true,
        });

        for (const dirent of dirents) {
            const filePath: string = path.join(directoryPath, dirent.name);

            if (dirent.isFile()) {
                if (sourceRegex.test(dirent.name) && !filePath.includes("test")) {
                    sources.push(filePath);
                }
            } else if (dirent.isDirectory()) {
                traverseDirectory(filePath);
            }
        }
    }

    traverseDirectory(rootPath);

    return [[], sources];
}

function processFile(functionGraph: graphs.FunctionGraph, filepath: string, verbose: number): void {
    const lines: string[] = getLines(filepath);

    let parser = new CParser(lines);
    const functions = parser.parse();

    // Add the functions to the graph
    for (const f of functions) {
        f.filename = filepath;
        if (verbose > 1) {
            console.log("  - processing function: " + f.name);
        }

        functionGraph.addFunction(f);
    }
}

export function buildGraphs(rootPath: string, verbose: number): graphs.FunctionGraph {
    const [headers, sources] = getSources(rootPath);

    const functionGraph = new graphs.FunctionGraph(rootPath);

    for (const header of headers) {
        if (verbose > 0) {
            console.log("processing file: " + header);
        }

        processFile(functionGraph, toPosix(header), verbose);
    }

    for (const source of sources) {
        if (verbose > 0) {
            console.log("processing file: " + source);
        }

        processFile(functionGraph, toPosix(source), verbose);
    }

    return functionGraph;
}
