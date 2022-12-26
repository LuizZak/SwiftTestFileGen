import * as vscode from 'vscode';
import { NestableProgress } from '../progress/nestableProgress';

/**
 * Allows throttling of a sequence of promises by feeding a generator function
 * with a given input array as promises are completed.
 * 
 * @param concurrent The maximum number of concurrent promises to execute at a time.
 * @param generator A promise-generating function that is invoked once per input.
 * @param input A list of input values that will feed the generator to produce
 *     the promises to throttle. If empty, this function returns immediately.
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
export async function throttleWithParameters<I, R>(
    concurrent: number,
    generator: (input: I) => Promise<R>,
    input: I[],
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken,
    unitsPerPromise?: number,
    thenF?: (result: R) => R
): Promise<R[]> {

    var remaining = Array.from(input);
    let results: R[] = [];

    while (remaining.length > 0) {
        if (cancellation && cancellation.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        const partial = await Promise.all(
            remaining
                .splice(0, concurrent)
                .map((input): Promise<R> => {
                    let promise = generator(input);
                    if (thenF) {
                        promise = promise.then(thenF);
                    }
                        
                    return promise.finally(() => progress?.increment(unitsPerPromise));
                })
        );

        results = results.concat(partial);
    }

    if (progress?.completedUnitCount === progress?.totalUnitCount) {
        progress?.complete();
    }

    return results;
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
export async function throttle<R>(
    concurrent: number,
    generators: (() => Promise<R>)[],
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken,
    unitsPerPromise?: number,
    thenF?: (result: R) => R
): Promise<R[]> {

    return throttleWithParameters(
        concurrent,
        (f) => f(),
        generators,
        progress,
        cancellation,
        unitsPerPromise,
        thenF
    );
}
