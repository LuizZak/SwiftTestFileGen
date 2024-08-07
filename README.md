# Swift Test File Generator for Visual Studio Code

An extension for Visual Studio Code that adds a shortcut for generating test files for Swift Package Manager projects.

## Features

### - Generate Test File

From a set of .swift files selected, right click and choose 'Generate Test File(s)':

![image](images/SwiftFileTestGen.gif)

### - Go to test file

With a file opened on an active editor, execute the command `> Swift Test File Generator: Go to test file...` to navigate to a test with a matching file name, or create a new test if none is found.

### - Go to source file

With a test file opened on an active editor, execute the command `> Swift Test File Generator: Go to source file...` to navigate to a source file with a matching file name.

##### Simple heuristic search

If the `swiftTestFileGen.gotoTestFile.useFilenameHeuristics` extension setting is `true`, the extension will use values provided to `swiftTestFileGen.gotoTestFile.heuristicFilenamePattern` to perform a simpler filename-based search when looking for test files. This will reduce the delay between invoking "Go to test file..." and "Go to source file..." and opening the test file, but may result in incorrect files being opened, if more than a single package with similar file names is present in the workspace.

## Requirements

A Swift 5.4 or later installation.

## Extension Settings

This extension contributes the following configurations:

| `swiftTestFileGen.fileGen.confirmation` | When to trigger a confirmation of the operation through a Refactor Preview window |
|---|---|
| Value | Description |
| `always` | Always requests confirmation of changes |
| `onlyIfMultiFile` | Only requests confirmation if more than one file is selected, or if the selected item is a directory |
| `onlyOnDirectories` | Only requests confirmation if the selection contains one or more directories |
| `never` | Never requests confirmation; always create test files straight away |

| `swiftTestFileGen.fileGen.emitImportDeclarations` | Whether to detect and emit import declarations from the original Swift file in generated test files. The import for the module being tested is always emitted no matter the configuration. |
|---|---|
| Value | Description |
| `always` | Always emit `import <Module>`, mirroring imports on original file. |
| `dependenciesOnly` | Only emit `import <Module>` for modules that are implicit or explicit dependencies in original package manifest. The dependency graph of the package is used to figure out whether a module being imported is a dependency. |
| `explicitDependenciesOnly` | Only emit `import <Module>` for modules that are explicit dependencies in original package manifest. |
| `never` | Never emit `import <Module>`, other than the module being tested and XCTest. |

| Configuration | Description | Default Value | 
|--|--|--|
| `swiftTestFileGen.gotoTestFile.useFilenameHeuristics` | Whether to use simple `<FileName>.swift` -> `<FileName><Suffix>.swift` heuristics (according to heuristicFilenamePattern) to find test files, instead of querying through the package manifest for paths.</br></br>If enabled, it might increase the speed of file switching at the cost of accuracy on projects with multiple Package.swift manifests. | `false` |
| `swiftTestFileGen.gotoTestFile.heuristicFilenamePattern` | A string template-like pattern string or array of patterns that contain a '$1' for substituting the original source file name and searching all workspace files.</br></br>Pattern is applied to filenames only, before the '.swift' extension, and is case-sensitive.</br></br>Supports an array of strings as well, in which case they are tested in the order they are defined when finding test/source files.</br></br>Ignored if `useFilenameHeuristics` is false. | `"$1Tests.swift"` |

## Known Issues

- A Package.swift is required on the workspace for the extension to find source and test files properly;
- ~~"Go to Test File..." can be slow at times.~~ Addressed with `gotoTestFile.useFilenameHeuristics`.

## Release Notes
(of last 3 updates)

### 0.6.1

- Adding 'Generate Test File(s)...' to editor tab context menu.

### 0.6.0

- Adding 'Go to Source File...' that complements 'Go to Test File...' and works the opposite way.
- Adding 'macro' target type support.
    - When a macro test target is detected, `SwiftSyntaxMacros` and `SwiftSyntaxMacrosTestSupport` are automatically imported in test files generated for that target.

### 0.5.0

- Adding `swiftTestFileGen.fileGen.emitImportDeclarations` configuration that enables copying import declarations from the original source file into the test file as a quick convenience.

Full changelog available at: [CHANGELOG.md](CHANGELOG.md)
