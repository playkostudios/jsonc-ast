export class WhitespacesToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Whitespaces, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {WhitespacesToken}
     */
    static assert(token) {
        return /** @type {WhitespacesToken} */ assertTokenType(token, JSONTokenType.Whitespaces);
    }

    static fromString(str) {
        const token = new WhitespacesToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        return token;
    }

    getCodePointsToken() {
        // FIXME this is a bad method. it should return a list of codepoints
        //       tokens, not one
        let token = null;
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                if (token) {
                    throw new Error('Multiple code point tokens in key');
                }

                token = child;
            } else if (child.type !== JSONTokenType.MultiLineComment && child.type !== JSONTokenType.SingleLineComment) {
                throw new Error('Unexpected token in key');
            }
        }

        if (token === null) {
            throw new Error('No code point token in key');
        }

        return token;
    }

    /** @returns {number} */
    guessIndent() {
        try {
            const wsStr = this.getCodePointsToken().evaluate();
            return wsStr.substring(wsStr.lastIndexOf('\n') + 1).length;
        } catch(_err) {
            return 0;
        }
    }
}