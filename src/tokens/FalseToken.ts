export class FalseToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.False, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {FalseToken}
     */
    static assert(token) {
        return /** @type {FalseToken} */ assertTokenType(token, JSONTokenType.False);
    }

    evaluate() {
        return false;
    }

    async write(streamWriter) {
        await streamWriter.writeString('false');
    }
}