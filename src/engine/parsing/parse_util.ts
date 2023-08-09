import { readFileSync } from "fs";
import { sep } from "path";

export function isLetter(char: string): boolean {
    return char.length === 1 && char.match(/[a-z]/i) !== null;
}

export function filenameFromPath(filepath: string): string {
    const split: string[] = filepath.split(sep);
    return split[split.length - 1];
}

export function getFunctionName(line: string): string {
    let end: number = 0;
    while (end < line.length) {
        if (line[end] === "(") {
            break;
        }
        end++;
    }

    let start: number = end - 1;
    while (start > 0) {
        if (!(isLetter(line[start]) || line[start] === "_")) {
            break;
        }
        start--;
    }

    return line.slice(start, end).trim();
}

export function getLines(filepath: string): string[] {
    const fileContent: string = readFileSync(filepath, "utf-8");
    const lines: string[] = fileContent.split("\n");
    return lines;
}

export function findAfterIndex(
    line: string,
    idx: number,
    term: string
): number {
    let i: number = idx;
    while (i < line.length) {
        if (term.includes(line[i])) {
            break;
        }
        i++;
    }
    return i;
}
