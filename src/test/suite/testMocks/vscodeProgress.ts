/* eslint-disable @typescript-eslint/naming-convention */
import * as assert from 'assert';
import * as vscode from 'vscode';

export class MockProgress<T> implements vscode.Progress<T> {
    public report_calls: T[] = [];

    report(value: T): void {
        this.report_calls.push(value);
    }

    assertWasReported(partial: Partial<T>) {
        if (this.findReportMatching(partial) === null) {
            this.assertFailed(
                `Expected to find at least one call to 'report(...)' with parameters ${format(partial)} but found none.`
            );
        }
    }

    assertWasNotReported(partial: Partial<T>) {
        if (this.findReportMatching(partial)) {
            this.assertFailed(
                `Expected to find at no call to 'report(...)' with parameters ${format(partial)} but found at least one.`
            );
        }
    }

    assertFailed(message: string): never {
        assert.fail(
            `${message}\n\nthis.report_calls = ${format(this.report_calls)}`
        );
    }

    findReportMatching(partial: Partial<T>): T | null {
        for (const value of this.report_calls) {
            var isMatch = true;

            for (const key in partial) {
                if (Object.prototype.hasOwnProperty.call(partial, key)) {
                    const expected = partial[key];
                    const actual = value[key];
                    
                    if (expected !== actual) {
                        isMatch = false;
                    }
                }
            }

            if (isMatch) {
                return value;
            }
        }

        return null;
    }
}

function format(value: any): string {
    return JSON.stringify(value);
}
