export class NullToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Null, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {NullToken}
     */
    static assert(token) {
        return /** @type {NullToken} */ assertTokenType(token, JSONTokenType.Null);
    }

    evaluate() {
        return null;
    }

    async write(streamWriter) {
        await streamWriter.writeString('null');
    }
}