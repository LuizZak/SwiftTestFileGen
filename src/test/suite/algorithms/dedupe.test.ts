import * as assert from 'assert';
import { describe, it } from 'mocha';
import { deduplicateStable } from '../../../algorithms/dedupe';

suite('dedupe.ts Test Suite', () => {
    describe('deduplicateStable', () => {
        it("must return an empty array of the input is empty", () => {
            const input: string[] = [];

            const result = deduplicateStable(input, (v) => v);

            assert.deepStrictEqual(result, []);
        });

        it("should deduplicate based on the 'key' callable parameter", () => {
            const input: string[] = [
                "foo",
                "bar",
                "baz",
            ];

            const result = deduplicateStable(input, (v) => v[0]);

            assert.deepStrictEqual(result, ["foo", "bar"]);
        });

        it("should return a stable array based on the input", () => {
            const input: string[] = [
                "bee",
                "foo",
                "bar",
                "baz",
                "faz",
                "foos",
            ];

            const result = deduplicateStable(input, (v) => v.substring(0, 2));

            assert.deepStrictEqual(result, ["bee", "foo", "bar", "faz"]);
        });
    });
});