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

export function targetProductDependencies(target: SwiftTarget): [name: string, productPackage: string][] {
    const dependencies = target.dependencies;
    if (dependencies === undefined) {
        return [];
    }

    const result: [string, string][] = [];

    dependencies.forEach((dep) => {
        if (dep.product !== undefined && dep.product.length >= 4) {
            const name = dep.product[0];
            const pkg = dep.product[1];

            if (name === null || pkg === null) {
                return;
            }

            result.push([name, pkg]);
        }
    });

    return result;
}
