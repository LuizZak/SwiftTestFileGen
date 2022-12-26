import * as vscode from 'vscode';
import { SwiftPackageManifest } from '../data/swiftPackage';
import { SwiftPackagePathsManager } from '../swiftPackagePathsManager';
import { FileSystemInterface } from './fileSystemInterface';

/** Interface for objects that can provide a SwiftPackageManifest for a file in a disk. */
export interface PackageProviderInterface {
    /**
     * Returns a package path manager for a Swift Package that contains a given
     * file.
     */
    swiftPackagePathManagerForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackagePathsManager>;

    /**
     * Returns a package manifest that contains a given file Uri.
     */
    swiftPackageManifestForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackageManifest>;
};
