# Change Log

All notable changes to the "Swift Test File Generator" extension will be documented in this file.

## [0.5.0]

- Adding `swiftTestFileGen.fileGen.emitImportDeclarations` configuration that enables copying import declarations from the original source file into the test file as a quick convenience.

## [0.4.1]

- Adding a "[(current)/(total)]" progress to some steps of test file generation progress reporting.
- Improving speed that large number of files are mapped to their respective Swift packages.

## [0.4.0]

- Improving progress reporting on notification while generating test files.
- Improving speed of file testing generation on large number of files sharing the same folders.
- Improving general throughput of I/O operations to reduce number of disk hits simultaneously.

## [0.3.5]

- Fixing error message when running 'Generate Test File(s)...' command from the command palette.

## [0.3.4]

- Now the "SwiftTestFileGen: Generate Test File(s)..." command opens up any existing test files for the selected source files that already exist on disk instead of silently terminating.

## [0.3.3]

- Renaming package to "Swift Test File Generator"

## [0.3.2]

- Now special characters in the test class name that where derived from the original source file are replaced with '_'.

## [0.3.1]

- Adding 'snippet' target type support.
- Disallowing special characters in patterns for `swiftTestFileGen.gotoTestFile.heuristicFilenamePattern`.

## [0.3.0]

- Fixing system, binary, and plugin targets not being recognized and resulting in Package.swift parse errors.
- Fixing package finding when creating test files for multiple files at once.

## [0.2.2]

- Fixing warnings being displayed despite no actual issues.

## [0.2.0]

- Added `swiftTestFileGen.gotoTestFile.heuristicFilenamePattern` and `swiftTestFileGen.gotoTestFile.useFilenameHeuristics` configurations that enable a simple file search pattern to be used for finding test files.

## [0.1.0]

- Now selecting files on workspaces with multiple Package.swift files correctly detects and creates test files respecting the packages;
- Fixed some issues with progress dialogs closing before work was really done.

## [0.0.1]

- Initial release
