import * as vscode from 'vscode';
import { SwiftPackageManifest } from '../data/swiftPackage';

/** Interface for objects that can provide a SwiftPackageManifest for a file in a disk. */
export interface PackageProviderInterface {
    swiftPackageManifestForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackageManifest>;
};
