export class SingleLineCommentToken extends JSONToken {
    constructor() {
        super(JSONTokenType.SingleLineComment, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {SingleLineCommentToken}
     */
    static assert(token) {
        return /** @type {SingleLineCommentToken} */ assertTokenType(token, JSONTokenType.SingleLineComment);
    }

    static wrapFromString(str) {
        const token = new SingleLineCommentToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        const wsToken = new WhitespacesToken();
        wsToken.children.push(token);
        return wsToken;
    }

    async write(streamWriter) {
        await streamWriter.writeString('//');
        await super.write(streamWriter);
    }
}