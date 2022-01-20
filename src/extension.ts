import path = require('path');
import * as vscode from 'vscode';
import * as fs from 'fs';
import { findSwiftPackage, swiftPackageManifestForFile } from './swiftPackageFinder';
import { proposeTestFiles } from './testFileGeneration';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "swifttestgen" is now active!');

	let disposable: vscode.Disposable;

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
