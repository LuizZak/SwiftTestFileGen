import * as vscode from 'vscode';
import { describe, it, beforeEach } from 'mocha';
import assert = require('assert');
import { VirtualDisk, VirtualDiskDirectory, VirtualDiskEntry, VirtualDiskEntryContainer, VirtualDiskEntryType, VirtualDiskFile, VirtualDiskRoot } from './virtualFileDisk';
import { fileUri } from '../commands/fullTestFixture';

suite('virtualFileDisk Test Suite', () => {
    let sut: VirtualDisk;
    beforeEach(() => {
        sut = new VirtualDisk();
    });

    test('ephemeral', () => {
        assert.deepStrictEqual(sut.root, new VirtualDiskRoot());
    });

    describe('createEntries', () => {
        it("should create file entries for non-trailing-slash entries", () => {
            sut.createEntries([
                '/file'
            ]);

            assert.deepStrictEqual(
                sut.root,
                createTestDisk(
                    new VirtualDiskFile("file")
                )
            );
        });

        it("should create directories for trailing-slash entries", () => {
            sut.createEntries([
                '/home/'
            ]);

            assert.deepStrictEqual(
                sut.root,
                createTestDisk(
                    new VirtualDiskDirectory("home", [])
                )
            );
        });
        
        it("should create intermediary directories", () => {
            sut.createEntries([
                '/home/dir/file'
            ]);

            assert.deepStrictEqual(
                sut.root,
                createTestDisk(
                    new VirtualDiskDirectory("home", [
                        new VirtualDiskDirectory("dir", [
                            new VirtualDiskFile("file")
                        ])
                    ])
                )
            );
        });
    });

    describe('createEntriesWithKind', () => {
        it("should respect the file kinds, irrespective of path kind or termination", () => {
            sut.createEntriesWithKind([
                ['/file.ext', VirtualDiskEntryType.file],
                ['/other.ext/', VirtualDiskEntryType.file],
                ['/dir', VirtualDiskEntryType.directory],
                ['/dir/dir', VirtualDiskEntryType.directory],
                [fileUri('/sub/file.ext'), VirtualDiskEntryType.file],
                [fileUri('/sub/sub'), VirtualDiskEntryType.directory],
            ]);

            assert.deepStrictEqual(
                sut.root,
                createTestDisk(
                    new VirtualDiskFile("file.ext"),
                    new VirtualDiskFile("other.ext"),
                    new VirtualDiskDirectory("dir", [
                        new VirtualDiskDirectory("dir"),
                    ]),
                    new VirtualDiskDirectory("sub", [
                        new VirtualDiskFile("file.ext"),
                        new VirtualDiskDirectory("sub"),
                    ]),
                )
            );
        });
    });

    describe('findEntry', () => {
        it("should return root for '/'", () => {
            assert.deepStrictEqual(sut.findEntry('/'), sut.root);
        });

        it("should find files", () => {
            sut.createEntries([
                '/file.ext',
            ]);

            assert.deepStrictEqual(
                sut.findEntry('/file.ext'),
                sut.root.contents[0]
            );
        });

        it("should find directories", () => {
            sut.createEntries([
                '/dir/',
            ]);

            assert.deepStrictEqual(
                sut.findEntry('/dir'),
                sut.root.contents[0]
            );
        });

        it("should ignore trailing slashes in directory searches", () => {
            sut.createEntries([
                '/dir/',
            ]);

            assert.deepStrictEqual(
                sut.findEntry('/dir/'),
                sut.root.contents[0]
            );
        });

        it("should return undefined for file paths that end in trailing slashes", () => {
            sut.createEntries([
                '/file',
            ]);
            
            assert.strictEqual(sut.findEntry('/file/'), undefined);
        });
    });

    describe('glob', () => {
        it("should find absolute paths", () => {
            sut.createEntries([
                '/root.ext',
                '/home/file.ext',
                '/home/dir/file.other',
                '/home/dir/dir/file.ext',
            ]);

            const result = sut.glob("/home/dir/file.other");

            assert.deepStrictEqual(result.map(f => f.fullPath("/")), [
                '/home/dir/file.other',
            ]);
        });

        it("should respect wild cards paths", () => {
            sut.createEntries([
                '/root.ext',
                '/home/file.ext',
                '/home/dir/file.other',
                '/home/dir/dir/file.ext',
            ]);

            const result = sut.glob("**/dir/*");

            assert.deepStrictEqual(result.map(f => f.fullPath("/")), [
                '/home/dir/file.other',
                '/home/dir/dir/file.ext',
            ]);
        });

        it("should respect globs of **/*.ext pattern", () => {
            sut.createEntries([
                '/root.ext',
                '/home/file.ext',
                '/home/dir/file.other',
                '/home/dir/dir/file.ext',
            ]);

            const result = sut.glob("**/*.ext");

            assert.deepStrictEqual(result.map(f => f.fullPath("/")), [
                "/root.ext",
                '/home/file.ext',
                '/home/dir/dir/file.ext',
            ]);
        });

        it("should respect relative globs", () => {
            sut.createEntries([
                '/root.ext',
                '/home/file.ext',
                '/home/dir/file.other',
                '/home/dir/dir/file.ext',
            ]);

            const result = sut.glob(new vscode.RelativePattern("/home/dir", "**/*.ext"));

            assert.deepStrictEqual(result.map(f => f.fullPath("/")), [
                '/home/dir/dir/file.ext',
            ]);
        });

        it("should respect relative globs with trailing slashes", () => {
            sut.createEntries([
                '/root.ext',
                '/home/file.ext',
                '/home/dir/file.other',
                '/home/dir/dir/file.ext',
            ]);

            const result = sut.glob(new vscode.RelativePattern("/home/dir/", "**/*.ext"));

            assert.deepStrictEqual(result.map(f => f.fullPath("/")), [
                '/home/dir/dir/file.ext',
            ]);
        });
    });
});

/** Prepares a test root disk by navigating through all entries, recursively setting the parent folder. */
function createTestDisk(...entries: VirtualDiskEntry[]): VirtualDiskRoot {
    const root = new VirtualDiskRoot(entries);
    const queue: [VirtualDiskEntry, VirtualDiskEntryContainer][] = entries.map(c => [c, root]);

    while (queue.length > 0) {
        const [next, parent] = queue.splice(0, 1)[0];

        next.parent = parent;

        if (next instanceof VirtualDiskDirectory) {
            const items: typeof queue = next.contents.map(c => [c, next]);
            queue.splice(queue.length, 0, ...items);
        }
    }

    return root;
}
