"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aesjs = require("aes-js");
class Secret {
    constructor(apiKey, ctr) {
        this.apiKey = apiKey;
        this.ctr = ctr;
    }
    static getSecret(string, counter = Math.floor(Math.random() * (1 << 30))) {
        const hex_string = counter.toString(16);
        const verifier = '0'.repeat(32 - hex_string.length) + hex_string;
        const cipher = new aesjs.ModeOfOperation.ctr(Secret.KEY, new aesjs.Counter(aesjs.utils.hex.toBytes(verifier)));
        return new Secret(aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(string))).toUpperCase(), counter);
    }
    static btoa(b) {
        return typeof btoa !== 'undefined' ? btoa(b) : Buffer.from(b).toString('base64');
    }
    static atob(a) {
        return typeof atob !== 'undefined' ? atob(a) : Buffer.from(a, 'base64').toString();
    }
    static xorByteArrays(a, b) {
        const result = [];
        for (let i = 0; i < a.length; ++i) {
            result[i] = a[i] ^ b[i % b.length];
        }
        return new Uint8Array(result);
    }
    static encodeString(base64String, page) {
        return aesjs.utils.utf8.fromBytes(Secret.xorByteArrays(aesjs.utils.utf8.toBytes(Secret.atob(base64String)), aesjs.utils.utf8.toBytes(page)));
    }
}
exports.default = Secret;
Secret.VENDOR_ID = (() => {
    let vendor_id = '';
    for (let i = 0; i < 16; ++i) {
        vendor_id += Math.floor(Math.random() * 16).toString(16);
    }
    return vendor_id;
})();
Secret.SECRET_STRING = Secret.encodeString('CCNzfiQsIDQ8MQ==', 'KMBMainView')
    + Secret.encodeString('ES4YfCcoJwUKEzN4', 'KMBMainView')
    + Secret.encodeString('fnwbCDQfJxMaFS4=', 'KMBMainView')
    + Secret.encodeString('ej0GBw0jCxJaXUo=', 'KMBMainView');
Secret.KEY = aesjs.utils.hex.toBytes(Secret.encodeString(Secret.SECRET_STRING, 'KMBSplashScreen'));
//# sourceMappingURL=Secret.js.map