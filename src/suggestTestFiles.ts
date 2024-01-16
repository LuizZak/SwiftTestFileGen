import path = require('path');
import * as vscode from 'vscode';
import { OperationWithDiagnostics, TestFileDiagnosticKind } from './data/testFileDiagnosticResult';
import { SwiftTestFile } from './data/swiftTestFile';
import { Configuration, EmitImportDeclarationsMode } from './data/configurations/configuration';
import { SwiftFileSyntaxHelper } from './syntax/swiftFileSyntaxHelper';
import { InvocationContext } from './interfaces/context';
import { NestableProgress, NestableProgressReportStyle } from './progress/nestableProgress';
import { limitWithParameters } from './asyncUtils/asyncUtils';
import { deduplicateStable } from './algorithms/dedupe';
import { SwiftFileBuilder } from './syntax/swiftFileBuilder';
import { SwiftFile } from './data/swiftFile';
import { SwiftPackagePathsManager } from './swiftPackagePathsManager';
import { SwiftTarget, TargetType } from './data/swiftPackage';
import { SourceToTestFileMapper } from './implementations/sourceToTestFileMapper';
import { targetProductDependencies } from './data/swiftPackage.ext';

/** Result object for a `suggestTestFiles` call. */
export type SuggestTestFilesResult = OperationWithDiagnostics<{ testFiles: SwiftTestFile[] }>;

/**
 * Returns a set of suggested test files for a list of .swift file paths.
 * 
 * @param filePaths File paths to generate test files out of.
 * @param configuration The extension configurations object.
 * @param context Context for invocation containing APIs to interact with to
 *     produce the result of this operation.
 * @param progress A progress object to report granular progress to.
 * @param cancellation A cancellation token to stop the operation.
 * @returns A list of Swift test files for the selected files, along with a list
 *     of diagnostics generated.
 */
export async function suggestTestFiles(
    filePaths: vscode.Uri[],
    configuration: Configuration,
    context: InvocationContext,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<SuggestTestFilesResult> {

    const directories = deduplicateStable(filePaths, (filePath) => {
        return path.dirname(filePath.path);
    });

    const filesProgress = progress?.createChild(
        filePaths.length + directories.length,
        undefined,
        "Parsing package manifests..."
    );

    // Warm up the cache prior to the operation by querying the file directories
    // first
    // TODO: Allow parameterization of concurrent task count.
    await limitWithParameters(10, async (directory) => {
        await context.packageProvider.swiftPackagePathManagerForFile(directory, cancellation);
    }, directories, filesProgress, cancellation);

    // Do proper operation now
    if (filesProgress) {
        filesProgress.showProgressInMessageStyle = NestableProgressReportStyle.asUnits;
    }

    filesProgress?.reportMessage("Finding existing test files...");

    const operation = async (filePath: vscode.Uri): Promise<SuggestTestFilesResult> => {
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        
        const packageProvider = context.packageProvider;
    
        const pkg = await packageProvider.swiftPackagePathManagerForFile(filePath, cancellation);
        const file = await pkg.loadSourceFile(filePath);
        
        const pathMapper = new SourceToTestFileMapper(pkg);

        const suggestedTestPath = await pathMapper.suggestedTestPathFor(file.path);
        if (!suggestedTestPath.transformedPath) {
            return {
                testFiles: [],
                ...suggestedTestPath,
            };
        }

        // Compute file / test class names
        const fileNameWithoutExt = path.basename(file.path.fsPath, ".swift");
        const testClassName = replaceSpecialCharactersForTestName(`${fileNameWithoutExt}Tests`);
        const testFileName = `${fileNameWithoutExt}Tests.swift`;

        const target = pkg.targetForFilePath(file.path);
        const testTarget = pkg.targetForFilePath(suggestedTestPath.transformedPath);

        const result = await generateTestFile(
            suggestedTestPath.transformedPath,
            file,
            target,
            testTarget,
            testClassName,
            testFileName,
            pkg,
            context,
            configuration
        );

        return {
            testFiles: [result],
            diagnostics: suggestedTestPath.diagnostics
        };
    };

    // TODO: Allow parameterization of concurrent task count.
    const result = await limitWithParameters(20, operation, filePaths, filesProgress, cancellation);
    return result.reduce(joinSuggestedTestFileResults);
}

async function generateTestFile(
    fullTestFilePath: vscode.Uri,
    sourceFile: SwiftFile,
    target: SwiftTarget | null,
    testTarget: SwiftTarget | null,
    testClassName: string,
    testFileName: string,
    pkg: SwiftPackagePathsManager,
    context: InvocationContext,
    configuration: Configuration
): Promise<SwiftTestFile> {

    const targetName = target?.name ?? await pkg.targetNameFromFilePath(sourceFile.path);

    const syntaxHelper = new SwiftFileSyntaxHelper(
        sourceFile.path,
        context.fileSystem,
        context.toolchain
    );

    let detectedImports: string[] = [];
    let importLines: string[] = [];

    switch (configuration.fileGen.emitImportDeclarations) {
        case EmitImportDeclarationsMode.always:
            detectedImports = await syntaxHelper.parseModuleImports();
            importLines = detectedImports.map(emitImportLine);

            break;

        case EmitImportDeclarationsMode.dependenciesOnly:
            // From detected module imports, emit the ones that are target
            // dependencies in the package manifest.
            if (target !== null) {
                const dependencyGraph = pkg.dependencyGraph();

                const parsedImports = await syntaxHelper.parseModuleImports();
                detectedImports = parsedImports.filter((moduleName) => {
                    return dependencyGraph.hasDependencyPath(target, moduleName);
                });
                importLines = detectedImports.map(emitImportLine);
            }
            break;

            case EmitImportDeclarationsMode.explicitDependenciesOnly:
                // From detected module imports, emit the ones that are explicit target
                // dependencies in the package manifest.
                if (target !== null) {
                    const dependencyGraph = pkg.dependencyGraph();
    
                    const parsedImports = await syntaxHelper.parseModuleImports();
                    detectedImports = parsedImports.filter((moduleName) => {
                        return dependencyGraph.hasDirectDependency(target, moduleName);
                    });
                    importLines = detectedImports.map(emitImportLine);
                }
                break;

        case EmitImportDeclarationsMode.never:
            break;
    }

    let moduleImportLine: string;
    if (typeof targetName === "string") {
        moduleImportLine = `@testable import ${targetName}`;
    } else {
        moduleImportLine = `@testable import <#TargetName#>`;
    }

    // Emit auxiliary testing imports for Swift macro targets
    if (isMacroTestTarget(target, testTarget)) {
        importLines.push(emitImportLine("SwiftSyntaxMacros"));
        importLines.push(emitImportLine("SwiftSyntaxMacrosTestSupport"));
    }

    // Build test file contents
    const fb = new SwiftFileBuilder();

    fb.line("import XCTest");
    fb.ensureEmptyLineSeparation();
    fb.line(moduleImportLine);
    fb.lines(...importLines);
    fb.ensureEmptyLineSeparation();
    fb.putEmptyClass(testClassName, ["XCTestCase"]);

    const result: SwiftTestFile = {
        name: testFileName,
        path: fullTestFilePath,
        originalFile: sourceFile.path,
        existsOnDisk: false,
        suggestedImports: detectedImports,
        contents: fb.build(),
    };

    return result;
}

function emitImportLine(moduleName: string): string {
    return `import ${moduleName}`;
}

function isMacroTestTarget(target: SwiftTarget | null, testTarget: SwiftTarget | null): boolean {
    if (!target || !testTarget) {
        return false;
    }
    if (target.type !== TargetType.Macro) {
        return false;
    }

    const targetDep = targetProductDependencies(testTarget);
    const expectedDeps: [string, string][] = [
        ["SwiftSyntaxMacros", "swift-syntax"],
        ["SwiftSyntaxMacrosTestSupport", "swift-syntax"],
    ];
    for (const exp of expectedDeps) {
        if (!targetDep.find(dep => dep[0] === exp[0] && dep[1] === exp[1])) {
            return false;
        }
    }

    return true;
}

/** Utility function for joining `SuggestTestFilesResult` objects. */
export function joinSuggestedTestFileResults(results1: SuggestTestFilesResult, results2: SuggestTestFilesResult): SuggestTestFilesResult {
    return joinOperationWithDiagnostics(results1, results2, (r1, r2) => {
        return { testFiles: r1.testFiles.concat(r2.testFiles) };
    });
}

/** Utility function for joining `OperationWithDiagnostics` objects. */
export function joinOperationWithDiagnostics<T>(results1: OperationWithDiagnostics<T>, results2: OperationWithDiagnostics<T>, joinRest: (arg0: T, arg1: T) => T): OperationWithDiagnostics<T> {
    const result = joinRest(results1, results2);

    return {
        ...result,
        diagnostics: results1.diagnostics.concat(results2.diagnostics),
    };
}

/** Replaces special characters in file names with an underscore for test class names */
export function replaceSpecialCharactersForTestName(str: string): string {
    return str.replace(/[@\+\-\s,.=]/g, "_");
}
