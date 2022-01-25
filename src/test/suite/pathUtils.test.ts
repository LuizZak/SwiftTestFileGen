import * as assert from 'assert';
import { describe } from 'mocha';
import path = require('path');
import { isSubdirectory, rootDirectoryOfRelativePath, sanitizeFilename } from '../../pathUtils';

suite('pathUtils Test Suite', () => {
    describe('isSubdirectory', () => {
        test('returns true for files in directory', () => {
            const basePath = path.join("base", "path");
            const filePath = path.join(basePath, "file");

            assert.strictEqual(isSubdirectory(basePath, filePath), true);
        });

        test('returns true for subdirectories', () => {
            const basePath = path.join("base", "path");
            const filePath = path.join(basePath, "sub", "sub2");

            assert.strictEqual(isSubdirectory(basePath, filePath), true);
        });

        test('returns false for same path', () => {
            const basePath = path.join("base", "path");

            assert.strictEqual(isSubdirectory(basePath, basePath), false);
        });

        test('returns false for different paths', () => {
            const basePath = path.join("base", "path");
            const otherPath = path.join("base", "path 2");

            assert.strictEqual(isSubdirectory(basePath, otherPath), false);
        });
    });

    describe('rootDirectoryOfRelativePath', () => {
        test('returns input for single directory paths', () => {
            const input = path.join("directory");

            assert.strictEqual(rootDirectoryOfRelativePath(input), input);
        });

        test('returns base directory for multi component paths', () => {
            const input = path.join("directory", "subdirectory", "file");

            assert.strictEqual(rootDirectoryOfRelativePath(input), "directory");
        });
    });

    test('sanitizeFilename', () => {
        assert.strictEqual(sanitizeFilename('filename.ext'), 'filename.ext');
        assert.strictEqual(sanitizeFilename('filename'), 'filename');
        assert.strictEqual(sanitizeFilename('file.name.ext'), 'file.name.ext');
        assert.strictEqual(sanitizeFilename('/file.name.ext'), 'file.name.ext');
        assert.strictEqual(sanitizeFilename('/../file.name.ext'), 'file.name.ext');
        assert.strictEqual(sanitizeFilename('..file.name.ext'), '..file.name.ext');
        assert.strictEqual(sanitizeFilename('..dir/file.name.ext'), 'file.name.ext');
        assert.strictEqual(sanitizeFilename('..dir/file.name.ext/'), 'file.name.ext');
        assert.strictEqual(sanitizeFilename('../dir/file.name.ext/'), 'file.name.ext');
    });
});
