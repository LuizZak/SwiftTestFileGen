// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path = require('path');
import * as vscode from 'vscode';
import * as fs from 'fs';
import { findSwiftPackage, swiftPackageManifestForFile } from './swiftPackageFinder';
import { proposeTestFiles } from './testFileGeneration';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "swifttestgen" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('swifttestgen.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from SwiftTestGen!');
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('swifttestgen.generateTestFile', async (_, fileUris: vscode.Uri[]) => {
		const packagePaths = await Promise.all(fileUris.map((fileUri) => {
			return findSwiftPackage(fileUri);
		}));

		// TODO: Handle cases where multiple package manifests where found.
		const filteredPackagePaths = packagePaths.flatMap(path => {
			if (path === null) {
				return [];
			}
			return [path];
		});

		if (filteredPackagePaths.length === 0) {
			vscode.window.showWarningMessage('Did not find a Package.swift manifest to derive test paths from for the selected files!');
			return;
		}

		const packageManifestPath = filteredPackagePaths[0];
		const packagePath = vscode.Uri.joinPath(packageManifestPath, "..");
		
		try {
			const pkg = await swiftPackageManifestForFile(packageManifestPath);
			
			const testFiles =
				proposeTestFiles(fileUris, packagePath, pkg)
				.filter(testFile => !fs.existsSync(testFile.path.fsPath));
			
			const wsEdit = new vscode.WorkspaceEdit();

			testFiles.forEach(file => {
				wsEdit.createFile(file.path);
				wsEdit.insert(file.path, new vscode.Position(0, 0), file.contents);
			});

			await vscode.workspace.applyEdit(wsEdit);
		} catch (err) {
			vscode.window.showErrorMessage(`Error while loading package manifest @ ${packageManifestPath.fsPath}: ${err}`);
		}
	});
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
