export class CommaToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Comma, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {CommaToken}
     */
    static assert(token) {
        return /** @type {CommaToken} */ assertTokenType(token, JSONTokenType.Comma);
    }

    async write(streamWriter) {
        await streamWriter.writeString(',');
    }
}