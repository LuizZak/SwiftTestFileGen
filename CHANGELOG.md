# Change Log

All notable changes to the "SwiftTestFileGen" extension will be documented in this file.

## [Unreleased]

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
