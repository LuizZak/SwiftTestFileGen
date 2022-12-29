/**
 * Performs deduplication of elements of an iterable object by using a specified
 * 'key' function to fetch a unique identifier for each item of the array,
 * returning a [stable](https://en.wikipedia.org/wiki/Sorting_algorithm#Stability)
 * array relative to `input` where no two pairs of elements evaluate to true under
 * `(v1, v2) => key(v1) === key(v2)`.
 */
export function deduplicateStable<T, U>(input: Iterable<T>, key: (value: T) => U): T[] {
    const result: T[] = [];
    const keys: Set<U> = new Set();

    for (const element of input) {
        const k = key(element);
        if (!keys.has(k)) {
            result.push(element);
            keys.add(k);
        }
    }

    return result;
}

/**
 * Performs deduplication of elements of an iterable object by using strict
 * equality (`===`) against previously seen items, returning a
 * [stable](https://en.wikipedia.org/wiki/Sorting_algorithm#Stability) array
 * relative to `input` where no two pairs of elements evaluate to true under
 * `(v1, v2) => v1 === v2`.
 */
export function deduplicateArrayStable<T>(input: Iterable<T>): T[] {
    return deduplicateStable(input, (v) => v);
}
