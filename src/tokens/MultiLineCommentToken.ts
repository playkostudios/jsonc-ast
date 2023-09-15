export class MultiLineCommentToken extends JSONToken {
    constructor() {
        super(JSONTokenType.MultiLineComment, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {MultiLineCommentToken}
     */
    static assert(token) {
        return /** @type {MultiLineCommentToken} */ assertTokenType(token, JSONTokenType.MultiLineComment);
    }

    static wrapFromString(str) {
        const token = new MultiLineCommentToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        const wsToken = new WhitespacesToken();
        wsToken.children.push(token);
        return wsToken;
    }

    async write(streamWriter) {
        await streamWriter.writeString('/*');
        await super.write(streamWriter);
        await streamWriter.writeString('*/');
    }
}