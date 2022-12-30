import { StringBuilder } from "./stringBuilder";

/**
 * A helper class for generating Swift files with simple declarations that are
 * needed for the extension to generate proper test files.
 */
export class SwiftFileBuilder extends StringBuilder {
    private indentLevel: number = 0;

    makeSection(fn: () => void) {
        this.ensureEmptyLineSeparation();
        
        fn();

        this.ensureEmptyLineSeparation();
    }

    putImport(moduleName: string) {
        this.line(`import ${moduleName}`);
    }

    putImports(moduleNames: string[]) {
        moduleNames.forEach(moduleName => this.putImport(moduleName));
    }

    putEmptyClass(name: string, inheritance?: [string]) {
        this.token("class");
        this.token(name);

        if (inheritance && inheritance.length > 0) {
            this.put(": ");
            this.commaSeparated(inheritance);
        }

        this.ensureSpace();
        this.line("{");
        this.line();
        this.line("}");
    }

    /** Alias for `this.withSpacing(t)`, for generating spaced tokens. */
    private token(t: string) {
        this.withSpacing(t);
    }

    /**
     * Emits a sequence of text values with a comma separating each item.
     */
    private commaSeparated(list: string[]) {
        this.commaSeparatedEmitter(list, i => this.put(i));
    }

    /**
     * Invokes a given emitter for every item in `list`, emitting item `item`,
     * ensuring there is a comma between every item.
     */
    private commaSeparatedEmitter<T>(list: T[], emitter: (item: T) => void) {
        super.emitWithSeparator(list, ", ", emitter);
    }

    // SECTION - Line emitting

    /**
     * Convenience for calling `this.line(l[n], true)` for every entry in a
     * string array
     */
    lines(...lines: string[]) {
        lines.forEach(line => this.line(line));
    }

    /**
     * Applies `text`, then a line break. The end of `text` is trimmed out of
     * whitespace before emitting the string.
     * If `indent` is `true`, if the leading of the current line is white space,
     * ensures that that white space is the proper indentation level, otherwise,
     * leaves the line as-is and only appends to the end of the buffer.
     */
    line(text: string = "", indent: boolean = true) {
        if (indent) {
            this.ensureIndentation();
        }

        this.put(text.trimEnd());
        this.putLineBreak();
    }

    /**
     * Emits a full line, with a leading and trailing line break. Leading line
     * break is not emitted if the last buffer character is already a line break.
     */
    fullLine(line: string, indent: boolean = true) {
        if (!this.isOnLineStart()) {
            this.putLineBreak();
        }

        if (indent) {
            this.putIndentation();
        }

        this.line(line);
    }

    // SECTION - Conditional emitting

    /**
     * Ensures that the last contents of the buffer are an empty line sequence
     * (`"\n\n"`). If it is not, then it emits the required number of line breaks
     * to fulfill the request. If the ongoing line is the first line of the
     * buffer, this method does not modify the buffer.
     */
    ensureEmptyLineSeparation() {
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
     * If the end of the buffer is white space but not the exact sequence of
     * `"\n" + this.indentString()`, adds or remove indentation characters as
     * required until the indentation is reached.
     *
     * Effectively resets the indentation of empty lines, but does not affect
     * non-empty lines.
     */
    private ensureIndentation() {
        if (!this.isOnEmptyLine()) {
            return;
        }

        this.replaceOngoingLine(this.indentString());
    }

    // SECTION - Raw buffer emitting

    /** Appends the indentation string to the end of the buffer. */
    private putIndentation() {
        this.put(this.indentString());
    }

    // SECTION - Buffer state querying

    private isAfterIndentation(): boolean {
        return this.buffer.endsWith(this.indentString());
    }

    // SECTION - Indentation

    private indent() {
        this.indentLevel += 1;
    }

    private unindent() {
        if(this.indentLevel > 0) {
            this.indentLevel -= 1;
        }
    }

    private indentString(): string {
        return "    ".repeat(this.indentLevel);
    }
}
