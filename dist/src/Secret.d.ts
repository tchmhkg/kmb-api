export default class Secret {
    readonly apiKey: string;
    readonly ctr: number;
    constructor(apiKey: string, ctr: number);
    static getSecret(string: string, counter?: number): Secret;
    static readonly VENDOR_ID: string;
    static btoa(b: string): string;
    static atob(a: string): string;
    private static xorByteArrays;
    private static encodeString;
    private static readonly SECRET_STRING;
    private static readonly KEY;
}
//# sourceMappingURL=Secret.d.ts.map