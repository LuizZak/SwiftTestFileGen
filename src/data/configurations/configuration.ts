import { ConfirmationMode } from "./confirmationMode";

/** Exposes configurations for this extension. */
export interface Configuration {
    fileGen: {
        confirmation: ConfirmationMode;
        emitImportDeclarations: EmitImportDeclarationsMode;
    }
    gotoTestFile: {
        useFilenameHeuristics: boolean;
        heuristicFilenamePattern: string | string[];
    }
}

export enum EmitImportDeclarationsMode {
    always = "always",
    explicitDependenciesOnly = "explicitDependenciesOnly",
    never = "never"
}
