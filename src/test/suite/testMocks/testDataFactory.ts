import { TargetDependency } from "../../../data/swiftPackage";

export function makeStringDependency(name: string): TargetDependency {
    return {
        byName: [
            name,
            null,
        ],
    };
}

export function makePackageDependency(module: string, packageName: string): TargetDependency {
    return {
        product: [
            module,
            packageName,
            null,
            null,
        ],
    };
}
