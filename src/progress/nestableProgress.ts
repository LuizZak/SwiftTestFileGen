import * as vscode from "vscode";

/**
 * Specifies the way current progress is attached to `NestableProgress` message
 * strings.
 */
export enum NestableProgressReportStyle {
    /** No progress is appended to messages. */
    none,

    /**
     * Completed and total units are treated as a percentage normalized from 0.0
     * to <total>>, and displayed as `[xxx%]`, with no decimal points.
     */
    asPercentage,

    /**
     * Completed and total units are treated as units, and displayed as
     * `[<completed>/<total>]`, with values rounded down.
     */
    asUnits,
};

/**
 * A progress reporting class that supports creating child progresses that are
 * logically connected to a parent progress object.
 */
export class NestableProgress {

    private onProgressCallbacks: ((progress: NestableProgress) => void)[] = [];
    private onCompletedCallbacks: ((progress: NestableProgress) => void)[] = [];

    private isCompleted: boolean = false;
    private parent: NestableProgress | null = null;
    private rootMessage: string | null = null;
    /**
     * How many units on this progress are equivalent to 1 unit on the parent
     * progress.
     */
    private rateOnParent: number = 1.0;

    private get _showShowProgress(): boolean {
        return this.message.length > 0 && this.showProgressInMessageStyle !== NestableProgressReportStyle.none;
    }

    private _completedUnitCount: number = 0;
    public get completedUnitCount(): number {
        return this._completedUnitCount;
    }
    private set completedUnitCount(value: number) {
        this._completedUnitCount = value;
    }

    /**
     * Returns `this.totalUnitCount - this.completedUnitCount`, or `0`, if the
     * prior is negative.
     */
    public get remainingUnitCount(): number {
        return Math.max(0, this.totalUnitCount - this.completedUnitCount);
    }

    /** 
     * Returns a value from 0 to 1 that represents the percentage of this progress
     * object from 0% to 100%.
     *
     * Only takes into account this object, but none of its parents.
     */
    public get fractionalProgress(): number {
        if (this.totalUnitCount === 0) {
            return 1.0;
        }

        return this.completedUnitCount / this.totalUnitCount;
    }

    /**
     * Specifies how many progress units a child progress will use by default on
     * calls to `this.createChild()`.
     *
     * If `null`, calls to `this.createChild()` use `this.remainingUnitCount` by
     * default as the number of units that completion of a child represent on this
     * progress object.
     */
    public unitsPerChild: number | null = null;

    /**
     * If `true`, the current progress value is automatically appended to the
     * current progress' message, if `this.message` is not empty, as a
     * `[<current>/<total>]`. The value is updated every time the progress is 
     * incremented, and is automatically placed before an ellipsis if one is
     * present at the end of the message string.
     */
    private _showProgressInMessageStyle: NestableProgressReportStyle = NestableProgressReportStyle.none;
    public get showProgressInMessageStyle(): NestableProgressReportStyle {
        return this._showProgressInMessageStyle;
    }
    public set showProgressInMessageStyle(value: NestableProgressReportStyle) {
        if (this._showProgressInMessageStyle === value) { return; }

        this._showProgressInMessageStyle = value;
        this.updateProgressMessage();
    }

    constructor(
        public progress: vscode.Progress<{ message?: string; increment?: number }>,
        public message: string = "",
        public totalUnitCount: number = 100,
    ) {

    }

    /** Registers a callback that is invoked every time progress is made. */
    onProgress(callback: (progress: NestableProgress) => void) {
        this.onProgressCallbacks.push(callback);
    }

    /** Registers a callback that is invoked when `this.complete()` is called. */
    onCompleted(callback: (progress: NestableProgress) => void) {
        this.onCompletedCallbacks.push(callback);
    }

    /**
     * Reports a textual message as a progress status. If this progress object is
     * a child of another progress object, the message is also cascaded up the
     * hierarchy to be displayed completely.
     */
    reportMessage(message: string) {
        if (this.isCompleted) { return; }

        this.message = message;

        this.recurseMessage();
    }

    /** Increments this progress object all the way to `this.totalUnitCount`. */
    complete() {
        if (this.isCompleted) { return; }

        this.increment(this.remainingUnitCount);

        // Reset message on parent progresses
        this.parent?.recurseMessage();

        this.isCompleted = true;
        
        this.invokeCompletedCallbacks();
    }

    /**
     * Increments `this.completedUnitCount` by a specified number of progress
     * units. Units are absolute and progress percentage is relative to
     * `this.totalUnitCount`.
     * 
     * @param progress The number of progress units to increment to `this.completedUnitCount`.
     *     Defaults to `1`.
     */
    increment(progress: number = 1) {
        this.recursive(
            (parent) => {
                let onParent;
                if (this.rateOnParent > 0) {
                    onParent = this.incrementInternal(progress) / this.rateOnParent;
                } else {
                    onParent = this.incrementInternal(progress) * 0.0;
                }

                parent.increment(onParent);

                this.recurseMessage();
            },
            () => {
                const previousFraction = this.fractionalProgress;

                this.incrementInternal(progress);

                const increment = (this.fractionalProgress - previousFraction) * 100.0;
                this.progress?.report({
                    message: this.rootMessage ?? this.message,
                    increment: increment
                });
            });
    }

    /** Convenience for `this.reportMessage(message); this.increment(progress);`. */
    incrementWithMessage(message: string, progress: number = 1) {
        this.increment(progress);
        this.reportMessage(message);
    }

    /**
     * Creates a child progress from this progress object that can be used to
     * track a smaller set of work units as if it was a contiguous progress on
     * itself.
     * 
     * @param unitsForChild The number of units that the child progress will have
     *     as `totalUnitCount`.
     * @param unitsOnThis The number of units that the child will represent on
     *     this progress object once it's completed. Defaults to `this.unitsPerChild`,
     *     or in case it is not defined, it's the remaining units all the way to
     *     `totalUnitCount`.
     * @param message An initial message for the child progress.
     * @returns A child progress that can be independently progressed and whose
     *     progress changes will be reported to this object as well.
     */
    createChild(
        unitsForChild: number,
        unitsOnThis: number = this.unitsPerChild ?? this.remainingUnitCount,
        message: string = ""
    ): NestableProgress {

        const child = new NestableProgress(this.progress, message, unitsForChild);
        child.parent = this;
        child.rateOnParent = unitsForChild / unitsOnThis;

        child.recurseMessage();

        return child;
    }

    /**
     * Invokes an asynchronous function that receives a temporary progress
     * object nested within this one.
     * 
     * @see `createChild()`
     */
    async withChildProgress<R>(
        unitsForChild: number,
        unitsOnThis: number = this.unitsPerChild ?? this.remainingUnitCount,
        message: string = "",
        work: (arg0: NestableProgress) => Promise<R>
    ): Promise<R> {

        const child = this.createChild(unitsForChild, unitsOnThis, message);

        const result = await work(child);

        child.complete();

        return result;
    }

    private incrementInternal(progress: number): number {
        if (this.isCompleted) { return 0; }
        if (this.remainingUnitCount === 0) { return 0; }

        const increment = Math.min(progress, this.remainingUnitCount);
        this.completedUnitCount += increment;

        if (this._showShowProgress) {
            this.updateProgressMessage();
        }

        this.invokeProgressCallbacks();

        return increment;
    }

    private updateProgressMessage() {
        this.recurseMessage();
    }

    private recurseMessage(messages: string[] = []) {
        let message = this.message;

        if (this._showShowProgress) {
            const progress = this.formatProgressMessage(this.showProgressInMessageStyle);

            const [prefix, ellipsis] = this.splitEndingEllipsis(message);

            message = `${prefix} ${progress}${ellipsis}`;
        }

        const fullMessages = [message].concat(messages);

        this.recursive(
            (parent) => {
                parent.recurseMessage(fullMessages);
            },
            () => {
                const finalMessage = this.formatMessages(fullMessages);

                this.rootMessage = finalMessage;

                this.progress.report({ message: finalMessage });
            });
    }

    private formatProgressMessage(style: NestableProgressReportStyle): string {
        switch(style) {
        case NestableProgressReportStyle.none:
            return "";

        case NestableProgressReportStyle.asPercentage:
            if (this.totalUnitCount === 0.0) {
                return "";
            }

            const ratio = this.completedUnitCount / this.totalUnitCount;

            return `[${Math.floor(ratio * 100.0)}%]`;
        
        case NestableProgressReportStyle.asUnits:
            return `[${Math.floor(this.completedUnitCount)}/${Math.floor(this.totalUnitCount)}]`;
        }
    }

    private formatMessages(messages: string[], charLimit: number = 150): string {
        messages = messages.filter(m => m.trim().length > 0);

        // Automatically trim "..." on intermediary message entries
        messages = messages.map((message, index) => {
            if (index < messages.length - 1 && message.endsWith("...")) {
                return this.splitEndingEllipsis(message)[0];
            }

            return message;
        });

        if (messages.length === 0) {
            return "";
        }

        const prefix = messages[0];
        const remainingLength = charLimit - prefix.length - 3;
        
        if (messages.length === 1) {
            return prefix;
        }
        if (remainingLength <= 0) {
            return `${prefix}...`;
        }

        let trailing = messages.slice(1).join(" - ");
        if (trailing.length > remainingLength) {
            trailing = trailing.slice(trailing.length - remainingLength);
            trailing = `...${trailing}`;
        }

        return `${prefix} - ${trailing}`;
    }

    private splitEndingEllipsis(str: string): [string, string] {
        if (!str.endsWith("...")) {
            return [str, ""];
        }

        return [str.slice(0, str.length - 3), "..."];
    }

    /**
     * Executes a closure depending on whether this object has a parent progress
     * associated with it or not.
     * `ifChild` is invoked if `this.parent` is not `null`, otherwise calls
     * `ifRoot`.
     *
     * The method is a no-op if `this.isCompleted` is `true`.
     *
     * Note: Although called `recursive()`, this method does not actually recurse
     * either function to parent objects itself, delegating that process to the
     * functions, for the sake of pre/post recurse control.
     */
    private recursive(ifChild: (parent: NestableProgress) => void, ifRoot: () => void) {
        if (this.isCompleted) { return; }

        if (this.parent) {
            ifChild(this.parent);
        } else {
            ifRoot();
        }
    }

    private invokeProgressCallbacks() {
        this.onProgressCallbacks.forEach(callback => callback(this));
    }

    private invokeCompletedCallbacks() {
        this.onCompletedCallbacks.forEach(callback => callback(this));
    }
}

/**
 * A helper method that takes in an array of promises and attaches a 'finally'
 * clause that automatically increments a specified progress object each time a
 * promise settles.
 *
 * If `progress` is null or undefined, `promises` is returned as-is.
 * 
 * @param promises A list of promises to attach a progress object to.
 * @param progress A progress object to use to represent the progress of
 *     settling each promise. If null or undefined, `promises` is returned as-is.
 *     If `progress.completedUnitCount` reaches `progress.totalUnitCount`, the
 *     progress object is automatically completed.
 * @param unitPerPromise An optional number of units to increment on `progress`
 *     per settled promise. If not provided, the default argument of
 *     `NestableProgress.increment()` is used, instead.
 * @returns Either the input array of promises with a 'finally' clause for
 * incrementing `progress`, or the unmodified `promises` array, if `progress` is
 * null or undefined.
 */
export function monitorWithProgress<R>(
    promises: Promise<R>[],
    progress: NestableProgress | undefined | null,
    unitsPerPromise?: number
): Promise<R>[] {

    if (!progress) {
        return promises;
    }

    return promises.map(p => p.finally(() => {
        progress.increment(unitsPerPromise);

        if (progress.completedUnitCount === progress.totalUnitCount) {
            progress.complete();
        }
    }));
}
