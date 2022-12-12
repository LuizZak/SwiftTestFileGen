import * as vscode from 'vscode';
import { Configuration } from './data/configurations/configuration';
import { ConfirmationMode } from './data/configurations/confirmationMode';
import { generateTestFilesEntry, gotoTestFileEntry } from './frontend';
import { FileSystem } from './implementations/fileSystem';
import { FileDiskPackageProvider } from './implementations/fileDiskPackageProvider';
import { VscodeWorkspace } from './implementations/vscodeWorkspace';
import { InvocationContext } from './interfaces/context';
import { FileSystemInterface } from './interfaces/fileSystemInterface';
import { PackageProviderInterface } from './interfaces/packageProviderInterface';
import { VscodeWorkspaceInterface } from './interfaces/vscodeWorkspaceInterface';

export async function activate(context: vscode.ExtensionContext) {
	let disposable: vscode.Disposable;

	disposable = vscode.commands.registerCommand('swifttestfilegen.generateTestFiles', async (_, fileUris: vscode.Uri[] | undefined) => {
		if (fileUris) {
			await generateTestFilesEntry(fileUris, makeContext());
		}
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('swifttestfilegen.gotoTestFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor === undefined) {
			return;
		}

		if (editor.document.uri.scheme === "file") {
			await gotoTestFileEntry(editor.document.uri, makeContext());
		}
	});
	context.subscriptions.push(disposable);
}

function makeContext(): InvocationContext {
	const fs = fileSystem();

	return {
		fileSystem: fs,
		workspace: workspace(),
		packageProvider: packageProvider(fs),
		configuration: configuration()
	};
}

function fileSystem(): FileSystemInterface {
	return new FileSystem();
}

function workspace(): VscodeWorkspaceInterface {
	return new VscodeWorkspace();
}

function configuration(): Configuration {
	const config = vscode.workspace.getConfiguration('swiftTestFileGen');
	const fileGen: Configuration["fileGen"] = config.get("fileGen") ?? {
		confirmation: ConfirmationMode.always
	};
	const gotoTestFile: Configuration["gotoTestFile"] = config.get("gotoTestFile") ?? {
		useFilenameHeuristics: false,
		heuristicFilenamePattern: "$1Tests",
	};

	return {
		fileGen,
		gotoTestFile,
	};
}

function packageProvider(fileSystem: FileSystemInterface): PackageProviderInterface {
	return new FileDiskPackageProvider(fileSystem);
}
