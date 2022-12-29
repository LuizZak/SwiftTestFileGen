/**
 * Specifies the list of predefined source search paths, in order of preference
 * by Swift Package Manager, relative to the root of the package.
 * 
 * Source: https://github.com/apple/swift-package-manager/blob/e0aadfff4397fb8da6cca72fc2129b479f3a2534/Sources/PackageDescription/Target.swift#L53
 */
export const predefinedSourceSearchPaths: string[] = [
    "Sources",
    "Source",
    "src",
    "srcs"
];

/**
 * Specifies the list of predefined test target search paths, in order of
 * preference by Swift Package Manager, relative to the root of the package.
 * 
 * Source: https://github.com/apple/swift-package-manager/blob/e0aadfff4397fb8da6cca72fc2129b479f3a2534/Sources/PackageDescription/Target.swift#L54
 */
 export const predefinedTestSearchPaths: string[] = [
     "Tests",
     "Sources",
     "Source",
     "src",
     "srcs"
];

/**
 * The default package manifest file name: `Package.swift`.
 */
export const defaultPackageManifestFileName = "Package.swift";
