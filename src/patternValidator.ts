import { OperationWithDiagnostics, TestFileDiagnosticKind } from "./data/testFileDiagnosticResult";

/** Performs validation for a pattern string. */
export function validatePattern(pattern: string): OperationWithDiagnostics<{ isValid: boolean }> {
    const placeholder = "$1";
    const placeholderRegex = /\$1/;

    const placeholderMatches = placeholderRegex.exec(pattern);
        
    if (!placeholderMatches || placeholderMatches.length !== 1) {
        return {
            isValid: false,
            diagnostics: [{
                message: `Found test file search pattern that does not contain exactly one copy of '${placeholder}' placeholder : ${pattern}`,
                kind: TestFileDiagnosticKind.incorrectSearchPattern,
            }]
        };
    }

    return {
        isValid: true,
        diagnostics: [],
    };
}
