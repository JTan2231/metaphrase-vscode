import * as graphs from "../graphs/function_graph";

import * as fs from "fs";
import * as path from "path";
import { filenameFromPath, getLines } from "./parse_util";
import { TypeScriptParser } from "./managers/keyword_manager";

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
