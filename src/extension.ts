// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { buildGraph } from './engine/parsing/parsing';
import * as fs from 'fs';
import * as path from 'path';
import { FunctionGraph } from './engine/graphs/function_graph';

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

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "metaphrase" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('metaphrase.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from metaphrase!');
	});

	const buildContext = vscode.commands.registerCommand('metaphrase.buildContext', () => {
		const paths: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
		let rootPath = paths !== undefined ? paths[0].uri.path : '';
		if (process.platform === 'win32') {
			rootPath = rootPath.slice(1);
		}

		const verbose = 1;
		const language = 'c';

		// look for metaphrase.json
		let functionGraph: FunctionGraph;
		if (fileExists(rootPath, 'metaphrase.json')) {
			console.log('existing context detected, loading metaphrase.json');
			functionGraph = new FunctionGraph('');
			functionGraph.deserialize(rootPath + '/metaphrase.json');
		} else {
			console.log('no existing context found, building new context');
			functionGraph = buildGraph(rootPath, verbose, language);
			console.log('graph built; serializing to ' + rootPath + '/metaphrase.json');
			functionGraph.serialize(rootPath + '/metaphrase.json');
		}

		functionGraph.printCount();
		vscode.window.showInformationMessage(`catalogued ${functionGraph.getCount()} functions`);
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(buildContext);
}

// This method is called when your extension is deactivated
export function deactivate() {}
