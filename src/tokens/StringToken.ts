export class StringToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.String, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {StringToken}
     */
    static assert(token) {
        return /** @type {StringToken} */ assertTokenType(token, JSONTokenType.String);
    }

    static fromString(str) {
        const token = new StringToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        return token;
    }

    evaluate() {
        return evalStringLikeToken('string', this);
    }

    async write(streamWriter) {
        await streamWriter.writeString('"');
        await super.write(streamWriter);
        await streamWriter.writeString('"');
    }
}