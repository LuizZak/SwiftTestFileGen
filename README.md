# swifttestfilegen for Visual Studio Code

An extension for Visual Studio Code that adds a shortcut for generating test files for Swift Package Manager projects.

## Features

From a set of .swift files selected, right click and choose 'Generate Test File(s)'.

![image](images/SwiftFileTestGen.gif)

## Requirements

A Swift 5.4 or later installation.

## Extension Settings

This extension contributes the following settings:

* `swifttestfilegen.fileGen.skipConfirm`: whether to skip confirmation and generate files straight away.

## Known Issues

A Package.swift is required on the workspace for the extension to find source and test files properly.

## Release Notes

### 0.0.1

Initial release
