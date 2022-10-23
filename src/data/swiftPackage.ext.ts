import { SwiftTarget } from './swiftPackage';

export function targetDependenciesByName(target: SwiftTarget): string[] {
    const dependencies = target.dependencies;
    if (dependencies === undefined) {
        return [];
    }

    const result: string[] = [];

    dependencies.forEach((dep) => {
        let name;
        if (dep.byName !== undefined && dep.byName.length >= 1) {
            name = dep.byName[0];
        } else if (dep.product !== undefined && dep.product.length >= 4) {
            name = dep.product[0];
        } else {
            return;
        }

        if (name !== null) {
            result.push(name);
        }
    });

    return result;
};
