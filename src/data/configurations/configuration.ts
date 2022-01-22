import { ConfirmationMode } from "./confirmationMode";

/** Exposes configurations for this extension. */
export interface Configuration {
    fileGen: {
        confirmation: ConfirmationMode;
    }
    gotoTestFile: {
        useFilenameHeuristics: boolean;
        heuristicFilenamePattern: string | string[];
    }
}
