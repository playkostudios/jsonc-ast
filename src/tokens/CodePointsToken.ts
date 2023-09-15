export class CodePointsToken extends JSONValueToken {
    constructor(codePoints) {
        super(JSONTokenType.CodePoints, false);
        this.codePoints = codePoints;
    }

    /**
     * @param {JSONToken} token
     * @returns {CodePointsToken}
     */
    static assert(token) {
        return /** @type {CodePointsToken} */ assertTokenType(token, JSONTokenType.CodePoints);
    }

    static fromCodePoint(codePoint) {
        return new CodePointsToken([codePoint]);
    }

    static fromString(str) {
        const codePoints = [];
        for (const codePointStr of str) {
            codePoints.push(codePointStr.codePointAt(0));
        }

        if (codePoints.length === 0) {
            throw new Error('Empty string');
        }

        return new CodePointsToken(codePoints);
    }

    evaluate() {
        return String.fromCodePoint(...this.codePoints);
    }

    async write(streamWriter) {
        await streamWriter.writeCodePoints(this.codePoints);
    }

    dump(depth = 0) {
        const parts = [`${'    '.repeat(depth)}<"`];

        for (const charStr of this.evaluate()) {
            switch (charStr) {
                case '\n':
                    parts.push('\\n');
                    break;
                case '\t':
                    parts.push('\\t');
                    break;
                case '\r':
                    parts.push('\\r');
                    break;
                case '"':
                case '\\':
                case '>':
                case '<':
                    parts.push('\\');
                    // falls through
                default:
                    parts.push(charStr);
            }
        }

        parts.push('">');
        console.debug(parts.join(''));
    }
}