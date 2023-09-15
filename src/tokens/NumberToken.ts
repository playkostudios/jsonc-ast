export class NumberToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Number, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {NumberToken}
     */
    static assert(token) {
        return /** @type {NumberToken} */ assertTokenType(token, JSONTokenType.Number);
    }

    static fromNumber(num) {
        if (!isFinite(num)) {
            throw new Error("Can't encode Infinity in JSON");
        } else if (isNaN(num)) {
            throw new Error("Can't encode NaN in JSON");
        }

        return NumberToken.fromString(num.toString());
    }

    static fromString(str) {
        const token = new NumberToken();
        token.children.push(CodePointsToken.fromString(str));
        return token;
    }

    evaluate() {
        const parts = [];
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                parts.push(child.evaluate());
            } else {
                throw new Error('Unexpected token in number');
            }
        }

        return Number(parts.join(''));
    }
}