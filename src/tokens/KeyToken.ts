export class KeyToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Key, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {KeyToken}
     */
    static assert(token) {
        return /** @type {KeyToken} */ assertTokenType(token, JSONTokenType.Key);
    }

    static fromString(str) {
        if (str === '') {
            throw new Error("Keys can't be empty");
        }

        const token = new KeyToken();
        token.children.push(CodePointsToken.fromString(str));
        return token;
    }

    getString() {
        return evalStringLikeToken('key', this);
    }

    async write(streamWriter) {
        await streamWriter.writeString('"');
        await super.write(streamWriter);
        await streamWriter.writeString('"');
    }
}