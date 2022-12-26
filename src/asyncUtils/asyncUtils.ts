import * as vscode from 'vscode';
import { NestableProgress } from '../progress/nestableProgress';

/**
 * Allows limiting the number of concurrent promises by feeding a generator
 * function with a given input array as promises are completed.
 * 
 * @param concurrent The maximum number of concurrent promises to execute at a time.
 * @param generator A promise-generating function that is invoked once per input.
 * @param input A list of input values that will feed the generator to produce
 *     the promises to limit. If empty, this function returns immediately.
 * @param progress A progress object that is incremented once per promise settled.
 *     If `progress.completedUnitCount` reaches `progress.totalUnitCount`, the
 *     progress object is automatically completed.
 * @param unitsPerPromise A custom number of units to increment the progress by.
 *     If not provided, progress is incremented by its default increment count.
 * @param cancellation A cancellation token that can be used to cancel all
 *     ongoing operations. Note that the cancellation token is only checked once
 *     every `concurrent` number of operations.
 * @param thenF An optional function that is invoked with the result of each
 *     promise as they are fulfilled.
 */
export async function limitWithParameters<I, R>(
    concurrent: number,
    generator: (input: I) => Promise<R>,
    input: I[],
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken,
    unitsPerPromise?: number,
    thenF?: (result: R) => R
): Promise<R[]> {

    type InputItem = [index: number, input: I] | undefined;
    type OutputItem = [index: number, output: R];

    let remaining = Array.from(input);
    let dequeued = 0;

    function dequeueNext(): InputItem {
        const next = remaining.shift();
        if (!next) {
            return;
        }

        return [dequeued++, next];
    }

    function generateLane(): Promise<OutputItem[]> {
        return new Promise(async (resolve, reject) => {
            if (cancellation && cancellation.isCancellationRequested) {
                reject(new vscode.CancellationError());
                return;
            }

            let current: OutputItem[] = [];

            while (true) {
                const next = dequeueNext();
                if (!next) {
                    break;
                }

                const result = await generator(next[1]).then(thenF);

                progress?.increment(unitsPerPromise);

                current.push([next[0], result]);
            }

            resolve(current);
        });
    }

    let lanes: Promise<OutputItem[]>[] = [];

    for (let i = 0; i < concurrent; i++) {
        lanes.push(generateLane());
    }

    let results = (await Promise.all(lanes)).flat();

    if (progress?.completedUnitCount === progress?.totalUnitCount) {
        progress?.complete();
    }

    // Re-order results based on index and return
    results.sort((a, b) => a[0] - b[0]);

    return results.map(r => r[1]);
}

/**
 * Allows limiting the throughput of a sequence of promise generators by running
 * 
 * @param concurrent The maximum number of concurrent promises to execute at a time.
 * @param generators A list of promise-generating functions that will feed the
 *     promises to execute. If empty, this function returns immediately.
 * @param progress A progress object that is incremented once per promise settled.
 *     If `progress.completedUnitCount` reaches `progress.totalUnitCount`, the
 *     progress object is automatically completed.
 * @param cancellation A cancellation token that can be used to cancel all
 *     ongoing operations. Note that the cancellation token is only checked once
 *     every `concurrent` number of operations.
 * @param unitsPerPromise A custom number of units to increment the progress by.
 *     If not provided, progress is incremented by its default increment count.
 * @param thenF An optional function that is invoked with the result of each
 *     promise as they are fulfilled.
 */
export async function limit<R>(
    concurrent: number,
    generators: (() => Promise<R>)[],
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken,
    unitsPerPromise?: number,
    thenF?: (result: R) => R
): Promise<R[]> {

    return limitWithParameters(
        concurrent,
        (f) => f(),
        generators,
        progress,
        cancellation,
        unitsPerPromise,
        thenF
    );
}
