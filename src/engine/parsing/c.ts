import * as graphs from '../graphs/function_graph';

import * as fs from 'fs';
import * as path from 'path';

class BraceStack {
    private stack: number;
    private begin: string;
    private end: string;

    constructor(begin: string, end: string) {
        this.stack = 0;

        this.begin = begin;
        this.end = end;
    }

    evalPush(c: string) {
        if (c === this.begin) {
            this.stack++;
        }
        else if (c === this.end) {
            this.stack--;
        }
    }

    len() {
        return this.stack;
    }
}

function getSources(rootPath: string): [string[], string[]] {
  const headerRegex: RegExp = /.*\.h$/;
  const sourceRegex: RegExp = /.*\.c$/;

  const headers: string[] = [];
  const sources: string[] = [];

  function traverseDirectory(directoryPath: string) {
    const dirents: fs.Dirent[] = fs.readdirSync(directoryPath, { withFileTypes: true });

    for (const dirent of dirents) {
      const filePath: string = path.join(directoryPath, dirent.name);

      if (dirent.isFile()) {
        if (headerRegex.test(dirent.name)) {
          headers.push(filePath);
        } else if (sourceRegex.test(dirent.name)) {
          sources.push(filePath);
        }
      } else if (dirent.isDirectory()) {
        traverseDirectory(filePath);
      }
    }
  }

  traverseDirectory(rootPath);

  return [headers, sources];
}

function getLines(filepath: string): string[] {
  const fileContent: string = fs.readFileSync(filepath, 'utf-8');
  const lines: string[] = fileContent.split('\n');
  return lines;
}

function findAfterIndex(line: string, idx: number, term: string): number {
  let i: number = idx;
  while (i < line.length) {
    if (term.includes(line[i])) {
      break;
    }
    i++;
  }
  return i;
}

function getImports(lines: string[]): string[] {
  const imports: string[] = [];

  for (const line of lines) {
    if (line.length > 8 && line.slice(0, 8) === '#include') {
      const nameStart: number = findAfterIndex(line, 8, '<"');
      const nameEnd: number = findAfterIndex(line, nameStart + 1, '>"');

      if (nameStart > 0 && nameEnd > 0 && nameEnd < line.length) {
        imports.push(line.slice(nameStart, nameEnd));
      }
    }
  }

  return imports;
}

function stringFromLines(lines: string[]): string {
  let out: string = '';
  for (const line of lines) {
    out += line;
  }
  return out;
}

function filenameFromPath(filepath: string): string {
  const split: string[] = filepath.split('/');
  return split[split.length - 1];
}

function getFunctionName(line: string): string {
  let end: number = 0;
  while (end < line.length) {
    if (line[end] === '(') {
      break;
    }
    end++;
  }

  let start: number = end - 1;
  while (start > 0) {
    if (!(isLetter(line[start]) || line[start] === '_')) {
      break;
    }
    start--;
  }

  return line.slice(start, end).trim();
}

function isLetter(char: string): boolean {
  return char.length === 1 && char.match(/[a-z]/i) !== null;
}

function processFile(functionGraph: graphs.FunctionGraph, filepath: string, verbose: number): void {
  const filename: string = filenameFromPath(filepath);
  const lines: string[] = getLines(filepath);
  const imports: string[] = getImports(lines);

  const functions: graphs.Function[] = [];

  const typeNames: RegExp = /void |unsigned |char |int |uint |long |float |double |static /;
  const branchingNames: RegExp = /if|while|for/;

  let l: number = 0;
  while (l < lines.length) {
    let line: string = lines[l];
    if (line.length > 0 && line[0] === '#') {
      let skip: number = 1;
      let tl: number = l;
      while (tl < lines.length && lines[tl].length > 0 && lines[tl][lines[tl].length - 1] === '\\') {
        skip++;
        tl++;
      }

      l += skip;

      continue;
    }

    let words: string = '';
    for (let i = 0; i < line.length; i++) {
      const c: string = line[i];
      words += c;
      const n: number = words.length;
      const m: number = Math.max(n - 2, 0);

      // Ignore comments
      if (words.slice(m).includes('/*')) {
        words = words.slice(m);
        let commentEnd: boolean = false;
        while (l < lines.length && !commentEnd) {
          commentEnd = lines[l].includes('*/');
          l++;
        }

        if (commentEnd) {
          l--;
        }

        break;
      } else if (words.slice(m).includes('//')) {
        words = '';
        continue;
      }

      // Potential function call/definition
      if (words[n - 1] === '(') {
        // Ignore #define macros
        if (lines[l][0] === '#') {
          continue;
        }

        if (n > 1 && isLetter(words[n - 2])) {
          // Get the entire function signature/call with arguments
          const bs = new BraceStack('(', ')');
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
          while (idx > 0 && (isLetter(rwi) || rwi === '_' || rwi === ' ')) {
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
          if (typeNames.test(words.slice(0, words.indexOf('(')))) {
            // Find the definition
            cl = l;
            while (cl < lines.length) {
              // Find the starting brace
              for (let j = 0; j < lines[cl].length; j++) {
                const dc: string = lines[cl][j];
                if (dc === '{') {
                  // Log the definition
                  isDefinition = true;
                  const dbs: BraceStack = new BraceStack('{', '}');
                  dbs.evalPush(dc);

                  let idx: number = j + 1;
                  while (cl < lines.length && dbs.len() > 0) {
                    def.push(lines[cl]);
                    while (dbs.len() > 0 && idx < lines[cl].length) {
                      dbs.evalPush(lines[cl][idx]);
                      idx++;
                    }

                    cl++;
                    idx = 0;
                  }

                  break;
                } else if (dc === ';') {
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
          if (words.length > 6 && words.slice(0, 7) === 'return ') {
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
              name: name,
              definition: def,
              calls: {},
            });
          } else {
            // This is to throw away function declarations
            // Functions are logged in the graph only if they're defined
            if (functions.length > 0) {
              functions[functions.length - 1].calls[name] = true;
            } else if (verbose > 2) {
              console.log('    - ignoring declaration: ' + name);
            }
          }

          words = '';
        }

        continue;
      }
    }

    l++;
  }

  // Add the functions to the graph
  for (const f of functions) {
    if (verbose > 1) {
      console.log('  - processing function: ' + f.name);
    }

    functionGraph.addFunction(f);
  }

  //console.log('finished processing file: ' + filepath);

  /*for (const imp of imports) {
    fileGraph.addNode(imp);
    fileGraph.addEdge(filename, imp);
  }*/
}

export function buildGraphs(rootPath: string, verbose: number): graphs.FunctionGraph {
  const [headers, sources] = getSources(rootPath);

  const functionGraph = new graphs.FunctionGraph('');

  for (const header of headers) {
    if (verbose > 0) {
      console.log("processing file: " + header);
    }

    processFile(functionGraph, header, verbose);
  }

  for (const source of sources) {
    if (verbose > 0) {
      console.log("processing file: " + source);
    }

    processFile(functionGraph, source, verbose);
  }

  return functionGraph;
}