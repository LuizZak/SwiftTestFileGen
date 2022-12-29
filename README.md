# Swift Test File Generator for Visual Studio Code

An extension for Visual Studio Code that adds a shortcut for generating test files for Swift Package Manager projects.

## Features

### - Generate Test File

From a set of .swift files selected, right click and choose 'Generate Test File(s)':

![image](images/SwiftFileTestGen.gif)

### - Go to Test File

With a file opened on an active editor, execute the command `> Swift Test File Generator: Go to test file...` to navigate to a test with a matching file name, or create a new test if none is found.

##### Simple heuristic search

If the `swiftTestFileGen.gotoTestFile.useFilenameHeuristics` extension setting is `true`, the extension will use values provided to `swiftTestFileGen.gotoTestFile.heuristicFilenamePattern` to perform a simpler filename-based search when looking for test files. This will reduce the delay between invoking "Go to Test File..." and opening the test file, but may result in incorrect files being opened, if more than a single package with similar file names is present in the workspace.

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

| Configuration | Description | Default Value | 
|--|--|--|
| `swiftTestFileGen.gotoTestFile.useFilenameHeuristics` | Whether to use simple `<FileName>.swift` -> `<FileName><Suffix>.swift` heuristics (according to heuristicFilenamePattern) to find test files, instead of querying through the package manifest for paths.</br></br>If enabled, it might increase the speed of file switching at the cost of accuracy on projects with multiple Package.swift manifests. | `false` |
| `swiftTestFileGen.gotoTestFile.heuristicFilenamePattern` | A string template-like pattern string or array of patterns that contain a '$1' for substituting the original source file name and searching all workspace files.</br></br>Pattern is applied to filenames only, before the '.swift' extension, and is case-sensitive.</br></br>Ignored if `useFilenameHeuristics` is false. | `"$1Tests.swift"` |

## Known Issues

- A Package.swift is required on the workspace for the extension to find source and test files properly;
- ~~"Go to Test File..." can be slow at times.~~ Addressed with `gotoTestFile.useFilenameHeuristics`.

## TODO

Add support for going back from a Tests/ file to a Sources/ file to compliment the Sources -> Tests command.

## Release Notes
(of last 3 updates)

### 0.4.1

- Adding a "[(current)/(total)]" progress to some steps of test file generation progress reporting.
- Improving speed that large number of files are mapped to their respective Swift packages.

### 0.4.0

- Improving progress reporting on notification while generating test files.
- Improving speed of file testing generation on large number of files sharing the same folders.
- Improving general throughput of I/O operations to reduce number of disk hits simultaneously.

### 0.3.5

- Fixing error message when running 'Generate Test File(s)...' command from the command palette.

Full changelog available at: [CHANGELOG.md](CHANGELOG.md)
