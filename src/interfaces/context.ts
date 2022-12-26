import { Configuration } from "../data/configurations/configuration";
import { FileSystemInterface } from "./fileSystemInterface";
import { PackageProviderInterface } from "./packageProviderInterface";
import { SwiftToolchainInterface } from "./swiftToolchainInterface";
import { VscodeWorkspaceInterface } from "./vscodeWorkspaceInterface";

/** Packs interfaces and configurations common to all extension invocations */
export interface InvocationContext {
    fileSystem: FileSystemInterface;
    workspace: VscodeWorkspaceInterface;
    packageProvider: PackageProviderInterface;
    configuration: Configuration;
    toolchain: SwiftToolchainInterface;
};
