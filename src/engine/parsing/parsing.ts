import * as fs from "fs";
import * as path from "path";
import * as c from "./c";
import * as ts from "./typescript";
import * as java from "./java";
import * as graphs from "../graphs/function_graph";

const SUPPORTED_FILETYPES: Record<
    string,
    (rootPath: string, verbose: number) => graphs.FunctionGraph
> = {
    c: c.buildGraphs,
    h: c.buildGraphs,
    ts: ts.buildGraphs,
    java: java.buildGraphs,
};

export function buildGraph(
    rootPath: string,
    verbose: number,
    language: string
): graphs.FunctionGraph {
    let buildFunction:
        | ((rootPath: string, verbose: number) => graphs.FunctionGraph)
        | null = null;

    if (language.length === 0) {
        fs.readdirSync(rootPath).forEach((filename) => {
            const fileType = path.extname(filename).substring(1);
            if (SUPPORTED_FILETYPES.hasOwnProperty(fileType)) {
                buildFunction = SUPPORTED_FILETYPES[fileType];
                return;
            }
        });
    } else {
        if (SUPPORTED_FILETYPES.hasOwnProperty(language)) {
            buildFunction = SUPPORTED_FILETYPES[language];
        } else {
            throw new Error(`BuildGraph: language ${language} not supported`);
        }
    }

    if (!buildFunction) {
        throw new Error("No supported file types found");
    }

    const functionGraph = buildFunction(rootPath, verbose);

    return functionGraph;
}
