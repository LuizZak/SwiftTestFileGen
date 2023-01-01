import * as assert from 'assert';
import { describe, it } from 'mocha';
import { StringBuilder } from '../../../syntax/stringBuilder';

suite('stringBuilder Test Suite', () => {
    describe("StringBuilder", () => {
        describe('ensureBufferEnd', () => {
            it("appends the full text if the buffer is empty", () => {
                const sut = new StringBuilder("");
                
                sut.ensureBufferEnd("0123");

                assert.strictEqual(sut.build(), "0123");
            });

            it("appends the full text if it doesn't match the buffer's end", () => {
                const sut = new StringBuilder("abcdef");
                
                sut.ensureBufferEnd("0123");

                assert.strictEqual(sut.build(), "abcdef0123");
            });

            it("skips characters that already match the buffer's end", () => {
                const sut = new StringBuilder("abcdef");
                
                sut.ensureBufferEnd("f123");
                sut.ensureBufferEnd("23b");

                assert.strictEqual(sut.build(), "abcdef123b");
            });

            it("skips the full string if it matches the buffer's end", () => {
                const sut = new StringBuilder("abcdef123");
                
                sut.ensureBufferEnd("f123");

                assert.strictEqual(sut.build(), "abcdef123");
            });
        });
    });
});
