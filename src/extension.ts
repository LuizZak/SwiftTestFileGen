import * as vscode from 'vscode';
import * as frontend from './frontend';
import { Configuration, EmitImportDeclarationsMode } from './data/configurations/configuration';
import { ConfirmationMode } from './data/configurations/confirmationMode';
import { FileSystem } from './implementations/fileSystem';
import { FileDiskPackageProvider } from './implementations/fileDiskPackageProvider';
import { VscodeWorkspace } from './implementations/vscodeWorkspace';
import { InvocationContext } from './interfaces/context';
import { FileSystemInterface } from './interfaces/fileSystemInterface';
import { PackageProviderInterface } from './interfaces/packageProviderInterface';
import { VscodeWorkspaceInterface } from './interfaces/vscodeWorkspaceInterface';
import { SwiftToolchainInterface } from './interfaces/swiftToolchainInterface';
import { FileDiskSwiftToolchain } from './implementations/fileDiskSwiftToolchain';

export async function activate(context: vscode.ExtensionContext) {
	let disposable: vscode.Disposable;

	disposable = vscode.commands.registerCommand('swifttestfilegen.generateTestFiles', async (_, fileUris: vscode.Uri[] | undefined) => {
		if (fileUris) {
			await frontend.generateTestFilesEntry(fileUris, makeContext());
		}
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('swifttestfilegen.gotoTestFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor === undefined) {
			return;
		}

		if (editor.document.uri.scheme === "file") {
			await frontend.gotoTestFileEntry(editor.document.uri, makeContext());
		}
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('swifttestfilegen.gotoSourceFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor === undefined) {
			return;
		}

		if (editor.document.uri.scheme === "file") {
			await frontend.gotoSourceFileEntry(editor.document.uri, makeContext());
		}
	});
	context.subscriptions.push(disposable);
}

function makeContext(): InvocationContext {
	const fs = fileSystem();
	const toolchain = swiftToolchain();

	return {
		fileSystem: fs,
		workspace: workspace(),
		packageProvider: packageProvider(fs, toolchain),
		configuration: configuration(),
		toolchain: toolchain,
	};
}

function fileSystem(): FileSystemInterface {
	return new FileSystem();
}

function swiftToolchain(): SwiftToolchainInterface {
	return new FileDiskSwiftToolchain();
}

function workspace(): VscodeWorkspaceInterface {
	return new VscodeWorkspace();
}

function configuration(): Configuration {
	const config = vscode.workspace.getConfiguration('swiftTestFileGen');
	const fileGen: Configuration["fileGen"] = config.get("fileGen") ?? {
		confirmation: ConfirmationMode.always,
		emitImportDeclarations: EmitImportDeclarationsMode.never,
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

function packageProvider(fileSystem: FileSystemInterface, toolchain: SwiftToolchainInterface): PackageProviderInterface {
	return new FileDiskPackageProvider(fileSystem, toolchain);
}
