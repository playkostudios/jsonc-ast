export class HexToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Hex, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {HexToken}
     */
    static assert(token) {
        return /** @type {HexToken} */ assertTokenType(token, JSONTokenType.Hex);
    }

    evaluate() {
        const parts = [];
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                parts.push(child.evaluate());
            } else {
                throw new Error('Unexpected token in unicode hex sequence');
            }
        }

        if (parts.length !== 4) {
            throw new Error(`Expected 4 code points in unicode hex sequence, got ${parts.length}`);
        }

        return String.fromCodePoint(Number.parseInt(parts.join(''), 16));
    }

    async write(streamWriter) {
        await streamWriter.writeString('u');
        await super.write(streamWriter);
    }
}