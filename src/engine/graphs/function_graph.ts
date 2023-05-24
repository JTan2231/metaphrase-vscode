import * as fs from 'fs';

export interface Function {
  filename: string;
  signature: string;
  name: string;
  definition: string[];
  calls: { [key: string]: boolean };
}

interface FunctionNode {
  filename: string;
  signature: string;
  name: string;
  definition: string[];
  definitionLine: number;
  declarationLine: number;
}

interface ImportEdges {
  functions: FunctionNode[];
  context: string;
}

export class FunctionGraph {
  filename: string;
  functions: { [key: string]: FunctionNode };
  dependencies: { [key: string]: FunctionNode[] };
  imports: { [key: string]: ImportEdges };
  dependencyQueueSet: { [key: string]: string[] };

  constructor(filename: string) {
    this.filename = filename;
    this.functions = {};
    this.dependencies = {};
    this.imports = {};
    this.dependencyQueueSet = {};
  }

  addFunction(f: Function): void {
    if (!(f.name in this.functions)) {
      this.functions[f.name] = {
        name: f.name,
        filename: f.filename,
        signature: f.signature,
        definition: f.definition,
        definitionLine: 0,
        declarationLine: 0,
      };

      const calls = Object.keys(f.calls);
      this.dependencyQueueSet[f.name] = calls;
    }
  }

  getFunctionNode(name: string): FunctionNode | null {
    if (name in this.functions) {
      return this.functions[name];
    } else {
      return null;
    }
  }

  setEdges(): void {
    const undefinedFunctions: { [key: string]: boolean } = {};
    for (const caller in this.dependencyQueueSet) {
      const callees = this.dependencyQueueSet[caller];
      const callerNode = this.getFunctionNode(caller);
      if (callerNode === null) {
        throw new Error(`SetEdges: callerNode function ${caller} does not exist in function graph`);
      }

      for (const callee of callees) {
        const calleeNode = this.getFunctionNode(callee);
        if (calleeNode === null) {
          undefinedFunctions[callee] = true;
          continue;
        }

        if (caller in this.dependencies) {
          this.dependencies[caller].push(calleeNode);
        } else {
          this.dependencies[caller] = [calleeNode];
        }

        if (callee in this.imports) {
          this.imports[callee].functions.push(callerNode);
        } else {
          this.imports[callee] = { functions: [callerNode], context: '' };
        }
      }
    }
  }

  setImportEdgeContext(functionName: string, context: string): void {
    if (functionName in this.imports) {
      this.imports[functionName].context = context;
    }
  }

  getDependencies(from: string): FunctionNode[] | null {
    if (from in this.dependencies) {
      return this.dependencies[from];
    } else {
      return null;
    }
  }

  getImports(from: string): ImportEdges {
    if (from in this.imports) {
      return this.imports[from];
    } else {
      return { functions: [], context: '' };
    }
  }

  printNodes(verbose: boolean): void {
    for (const filename in this.functions) {
      const node = this.functions[filename];
      console.log(`function name: ${filename}`);

      if (verbose) {
        for (let lineNumber = 0; lineNumber < node.definition.length; lineNumber++) {
          console.log(`${lineNumber}: ${node.definition[lineNumber]}`);
        }
      }
    }

    console.log(`printed ${Object.keys(this.functions).length} functions`);
  }

  printEdges(): void {
    for (const from in this.dependencies) {
      const node = this.functions[from];
      for (const to of this.dependencies[from]) {
        console.log(`${node.name} -> ${to.name}`);
      }

      console.log('------------');
    }
  }

  printImportEdges(): void {
    for (const from in this.imports) {
      const node = this.functions[from];
      for (const to of this.imports[from].functions) {
        console.log(`${node.name} -> ${to.name}`);
      }

      console.log('------------');
    }
  }

  printImportEdge(name: string): void {
    console.log(`Import edges for ${name}:`);
    if (name in this.imports) {
      for (const to of this.imports[name].functions) {
        console.log(`  - ${name} -> ${to.name}`);
      }
    }
  }

  printCount(): void {
    console.log(`${Object.keys(this.functions).length} functions`);
  }

  getCount(): number {
    return Object.keys(this.functions).length;
  }

  printNode(functionName: string): void {
    console.log(`printing function ${functionName}`);
    if (functionName in this.functions) {
      const node = this.functions[functionName];
      for (const to of this.dependencies[functionName]) {
        console.log(`${node.name} -> ${to.name}`);
      }
    } else {
      console.log(`error: couldn't find ${functionName}`);
    }

    console.log('------------');
  }

  serialize(filename: string): void {
    fs.writeFileSync(filename, JSON.stringify(this));
    console.log(`Function graph serialized to ${filename}`);
  }
  
  deserialize(filename: string): void {
    const data = fs.readFileSync(filename, 'utf-8');
    const graph = JSON.parse(data) as FunctionGraph;
    Object.assign(this, graph);
    console.log(`Function graph deserialized from ${filename}`);
  }
}

function nameFromSignature(signature: string): string {
  let name = '';
  let i = 0;
  while (i < signature.length && signature[i] !== '(') {
    name += signature[i];
    i++;
  }

  const split = name.split(' ');
  name = split[split.length - 1]; // take functionName from e.g. { int functionName() }

  return name;
}

function newFunctionGraph(): FunctionGraph {
  return new FunctionGraph('');
}
