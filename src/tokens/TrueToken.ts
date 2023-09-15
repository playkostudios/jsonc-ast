export class TrueToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.True, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {TrueToken}
     */
    static assert(token) {
        return /** @type {TrueToken} */ assertTokenType(token, JSONTokenType.True);
    }

    evaluate() {
        return true;
    }

    async write(streamWriter) {
        await streamWriter.writeString('true');
    }
}