export class ColonToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Colon, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {ColonToken}
     */
    static assert(token) {
        return /** @type {ColonToken} */ assertTokenType(token, JSONTokenType.Colon);
    }

    async write(streamWriter) {
        await streamWriter.writeString(':');
    }
}