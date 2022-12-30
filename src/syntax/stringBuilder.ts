/**
 * A base class with string-building functionality that can be extended with
 * custom logic to produce line-break-based structured files.
 */
export class StringBuilder {
    protected buffer: string;
    protected lineBreakChar: string = "\n";

    constructor(buffer: string = "") {
        this.buffer = buffer;
    }
    
    /** Converts the current buffer into a string and returns it. */
    build(): string {
        return this.buffer;
    }

    /**
     * Invokes a given emitter for every item in `list`, emitting item `item`,
     * ensuring there is a copy of `separator` between every item.
     */
    emitWithSeparator<T>(list: T[], separator: string, emitter: (item: T) => void) {
        for(var i = 0; i < list.length; i++) {
            if (i > 0) {
                this.put(separator);
            }

            emitter(list[i]);
        }
    }

    /**
     * If the last line of the buffer is not a space (including line break),
     * emits a single space character, then unconditionally emits `text`.
     *
     * Convenience for `this.ensureSpace(); this.put(text);`.
     */
    withSpacing(text: string) {
        this.ensureSpace();

        this.put(text);
    }

    /**
     * If the last line of the buffer is not a space (including line break),
     * emits a single space character.
     */
    ensureSpace() {
        if (!this.isAfterSpace()) {
            this.putSpace();
        }
    }

    /**
     * Ensures that the last contents of the buffer are an empty line sequence
     * (`"\n\n"`). If it is not, then it emits the required number of line breaks
     * to fulfill the request. If the ongoing line is the first line of the
     * buffer, this method does not modify the buffer.
     *
     * @param lineCount Number of lines to use as separator. Must be > 0.
     */
    ensureEmptyLineSeparation(lineCount: number = 2) {
        console.assert(lineCount > 0);

        if (this.ongoingLineRange()[0] === 0) {
            return;
        }

        if (this.buffer.endsWith(this.lineBreakChar.repeat(2))) {
            return;
        }
        if (this.buffer.endsWith(this.lineBreakChar)) {
            this.putLineBreak();
            return;
        }

        this.putLineBreak();
        this.putLineBreak();
    }

    /**
     * Ensures that the end of the buffer matches `text`. If buffer ends partially
     * with `text`, the function emits the rest of the characters until `text`
     * is fully emitted.
     *
     * This method works on the entire contiguous buffer and thus can be used to
     * modify line breaks as well.
     */
    ensureBufferEnd(text: string) {
        if (text.length === 0) {
            return;
        }
        if (this.buffer.endsWith(text)) {
            return;
        }

        for (let i = text.length - 1; i >= 0; i--) {
            const substring = text.slice(0, i + 1);

            if (this.buffer.endsWith(substring)) {
                const remainder = text.slice(i + 1);
                this.put(remainder);

                return;
            }
        }

        this.put(text);
    }

    /**
     * Replaces the contents of every character after the last line break character,
     * or from the start of the buffer, if no line break is present, with `text`.
     */
    replaceOngoingLine(text: string) {
        const lineRange = this.ongoingLineRange();

        if (lineRange[0] === lineRange[1] && lineRange[0] === this.buffer.length) {
            this.put(text);
            return;
        }

        this.buffer = this.buffer.slice(0, lineRange[0]);
        this.put(text);
    }

    // SECTION - Raw buffer emitting

    /** Appends a line break character. Alias for `this.put("\n")`. */
    putLineBreak() {
        this.put(this.lineBreakChar);
    }

    /** Raw append directly to the buffer with no pre- or post-processing. */
    put(text: string) {
        this.buffer += text;
    }

    /** Appends a space character. Alias for `this.put(" ")`. */
    putSpace() {
        this.put(" ");
    }

    // SECTION - Buffer state querying

    /**
     * The latest line on the buffer, or every character after the latest line
     * break. If no line break is present, returns the entire buffer.
     * Does not include the line break character itself.
     */
    ongoingLine(): string {
        return this.buffer.slice(...this.ongoingLineRange());
    }

    /**
     * The latest line interval on the buffer, or the start character after the
     * latest line break, up until the end of the buffer. If no line break is
     * present, returns the entire buffer range.
     *
     * Does not include the index of the line break character itself.
     */
    ongoingLineRange(): [number, number] {
        const end = this.buffer.length;

        const lastLineBreak = this.buffer.lastIndexOf(this.lineBreakChar);
        if (lastLineBreak === -1) {
            return [0, end];
        }

        return [lastLineBreak + 1, end];
    }

    /** Returns `true` if the buffer ends with a line break, or if it is empty. */
    isOnLineStart(): boolean {
        return this.buffer.length === 0 || this.buffer.endsWith(this.lineBreakChar);
    }

    /** Returns `true` if the buffer ends with an empty line. */
    isOnEmptyLine(): boolean {
        if (this.isOnLineStart()) {
            return true;
        }

        const lastLineBreak = this.buffer.lastIndexOf(this.lineBreakChar);
        if (lastLineBreak === -1) {
            return false;
        }

        return this.buffer.slice(lastLineBreak).trim().length === 0;
    }

    /**
     * Returns `true` if the last character in the buffer is a line break, a tab
     * character, of a space character. Also returns `true` if the buffer is empty.
     */
    isAfterSpace(): boolean {
        return this.isOnLineStart() || this.buffer.endsWith(" ") || this.buffer.endsWith("\t");
    }
}
