/* eslint-disable curly */
/* eslint-disable @typescript-eslint/naming-convention */
// To parse this data:
//
//   import { SwiftPackageManifestParser, SwiftPackageManifest } from "./file";
//
//   const swiftPackageManifest = SwiftPackageManifestParser.toSwiftPackageManifest(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface SwiftPackageManifest {
    dependencies?: SwiftPackageManifestDependency[];
    name:          string;
    targets:       SwiftTarget[];
    toolsVersion:  ToolsVersion;
}

export interface SwiftPackageManifestDependency {
    fileSystem?:    FileSystem[];
    sourceControl?: SourceControl[];
}

export interface FileSystem {
    identity:      string;
    path:          string;
    productFilter: null;
}

export interface SourceControl {
    identity: string;
}

export interface SwiftTarget {
    dependencies?: TargetDependency[];
    exclude?:      string[];
    name:          string;
    path?:         string;
    resources?:    Resource[];
    type:          TargetType;
}

export interface TargetDependency {
    byName?:  Array<null | string>;
    product?: Array<null | string>;
}

export interface Resource {
    path: string;
}

export enum TargetType {
    Binary = "binary",
    Executable = "executable",
    Plugin = "plugin",
    Regular = "regular",
    Snippet = "snippet",
    System = "system",
    Test = "test",
}

export interface ToolsVersion {
    _version: string;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class SwiftPackageManifestParser {
    public static toSwiftPackageManifest(json: string): SwiftPackageManifest {
        return cast(JSON.parse(json), r("SwiftPackageManifest"));
    }

    public static swiftPackageManifestToJson(value: SwiftPackageManifest): string {
        return JSON.stringify(uncast(value, r("SwiftPackageManifest")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any = ''): never {
    if (key) {
        throw Error(`Invalid value for key "${key}". Expected type ${JSON.stringify(typ)} but got ${JSON.stringify(val)}`);
    }
    throw Error(`Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`, );
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases, val);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue("array", val);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue("Date", val);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue("object", val);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, prop.key);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val);
    }
    if (typ === false) return invalidValue(typ, val);
    while (typeof typ === "object" && typ.ref !== undefined) {
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "SwiftPackageManifest": o([
        { json: "dependencies", js: "dependencies", typ: u(undefined, a(r("SwiftPackageManifestDependency"))) },
        { json: "name", js: "name", typ: "" },
        { json: "targets", js: "targets", typ: a(r("SwiftTarget")) },
        { json: "toolsVersion", js: "toolsVersion", typ: r("ToolsVersion") },
    ], "any"),
    "SwiftPackageManifestDependency": o([
        { json: "fileSystem", js: "fileSystem", typ: u(undefined, a(r("FileSystem"))) },
        { json: "sourceControl", js: "sourceControl", typ: u(undefined, a(r("SourceControl"))) },
    ], "any"),
    "FileSystem": o([
        { json: "identity", js: "identity", typ: "" },
        { json: "path", js: "path", typ: "" },
        { json: "productFilter", js: "productFilter", typ: null },
    ], "any"),
    "SourceControl": o([
        { json: "identity", js: "identity", typ: "" },
    ], "any"),
    "SwiftTarget": o([
        { json: "dependencies", js: "dependencies", typ: u(undefined, a(r("TargetDependency"))) },
        { json: "exclude", js: "exclude", typ: u(undefined, a("")) },
        { json: "name", js: "name", typ: "" },
        { json: "path", js: "path", typ: u(undefined, "") },
        { json: "resources", js: "resources", typ: u(undefined, a(r("Resource"))) },
        { json: "type", js: "type", typ: r("TargetType") },
    ], "any"),
    "TargetDependency": o([
        { json: "byName", js: "byName", typ: u(undefined, a(u(null, ""))) },
        { json: "product", js: "product", typ: u(undefined, a(u(null, ""))) },
    ], "any"),
    "Resource": o([
        { json: "path", js: "path", typ: "" },
    ], "any"),
    "ToolsVersion": o([
        { json: "_version", js: "_version", typ: "" },
    ], "any"),
    "TargetType": [
        "binary",
        "executable",
        "plugin",
        "regular",
        "snippet",
        "system",
        "test",
    ],
};
