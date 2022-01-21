import * as vscode from 'vscode';

/** An interface for abstracting operations that open, modify, and save files in VSCode. */
export interface VscodeWorkspaceInterface {
    /** Requests a new instance of `VscodeWorkspaceEdit`. */
    makeWorkspaceEdit(): VscodeWorkspaceEditInterface;

    /** Requests that a document with a matching Uri be saved, if unsaved changes are pending. */
    saveOpenedDocument(uri: vscode.Uri): Promise<void>;

    /** Requests that a text document pointing to a given file Uri be displayed. */
    showTextDocument(uri: vscode.Uri, options?: vscode.TextDocumentShowOptions): Promise<void>;
}

/** Interface that abstracts away VSCode document changes. */
export interface VscodeWorkspaceEditInterface {
    /**
     * Create a regular file.
     *
     * @param uri Uri of the new file..
     * @param options Defines if an existing file should be overwritten or be
     * ignored. When overwrite and ignoreIfExists are both set overwrite wins.
     * When both are unset and when the file already exists then the edit cannot
     * be applied successfully.
     * @param metadata Optional metadata for the entry.
     */
    createFile(uri: vscode.Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }, metadata?: vscode.WorkspaceEditEntryMetadata): void;
    
    /**
     * Replaces the contents of a given document uri with a new text.
     *
     * @param uri A resource identifier.
     * @param newText A string to replace the contents of the document with.
     * @param metadata Optional metadata for the entry.
     */
    replaceDocumentText(uri: vscode.Uri, newText: string, metadata?: vscode.WorkspaceEditEntryMetadata): void;

    /** Applies this sequence of workspace edits. */
    applyWorkspaceEdit(): Promise<void>;
}
