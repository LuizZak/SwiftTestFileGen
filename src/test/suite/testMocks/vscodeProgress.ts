/* eslint-disable @typescript-eslint/naming-convention */
import * as assert from 'assert';
import * as vscode from 'vscode';

export class MockProgress<T> implements vscode.Progress<T> {
    public report_calls: T[] = [];

    report(value: T): void {
        this.report_calls.push(value);
    }

    assertWasReported(partial: Partial<T>) {
        if (this.firstReportMatching(partial) === null) {
            this.assertFailed(
                `Expected to find at least one call to 'report(...)' with parameters ${format(partial)} but found none.`
            );
        }
    }

    assertWasNotReported(partial: Partial<T>) {
        if (this.firstReportMatching(partial)) {
            this.assertFailed(
                `Expected to find at no call to 'report(...)' with parameters ${format(partial)} but found at least one.`
            );
        }
    }

    assertLastReported(partial: Partial<T>) {
        if (this.report_calls.length === 0) {
            this.assertFailed(
                `Expected last report update to be ${format(partial)} but found no update.`
            );
        }

        const last = this.report_calls[this.report_calls.length - 1];

        if (!this.reportMatchesPartial(last, partial)) {
            this.assertFailed(
                `Expected last report update to be ${format(partial)} but found ${format(last)}.`
            );
        }
    }

    /**
     * Asserts all `report()` calls receive a value that matches with the given
     * partial value. If no `report()` calls where made, the assertion succeeds.
     */
    assertAllReportsMatch(partial: Partial<T>) {
        const allMatching = this.allReportsMatching(partial);

        if (allMatching.length !== this.report_calls.length) {
            this.assertFailed(
                `Expected all calls to 'report(...)' to have parameters ${format(partial)} but found at least one that isn't.`
            );
        }
    }

    /**
     * Asserts a given number of `report()` calls where made.
     */
    assertReportsCount(total: number) {
        if (this.report_calls.length !== total) {
            this.assertFailed(
                `Expected ${total} calls to 'report(...)', found ${this.report_calls.length}.`
            );
        }
    }

    assertFailed(message: string): never {
        assert.fail(
            `${message}\n\nthis.report_calls = ${format(this.report_calls)}`
        );
    }

    firstReportMatching(partial: Partial<T>): T | null {
        for (const value of this.report_calls) {
            if (this.reportMatchesPartial(value, partial)) {
                return value;
            }
        }

        return null;
    }

    allReportsMatching(partial: Partial<T>): T[] {
        let result: T[] = [];

        for (const value of this.report_calls) {
            if (this.reportMatchesPartial(value, partial)) {
                result.push(value);
            }
        }

        return result;
    }

    reportMatchesPartial(value: T, partial: Partial<T>): boolean {
        for (const key in partial) {
            if (Object.prototype.hasOwnProperty.call(partial, key)) {
                const expected = partial[key];
                const actual = value[key];
                
                if (expected !== actual) {
                    return false;
                }
            }
        }

        return true;
    }
}

function format(value: any): string {
    return JSON.stringify(value);
}
