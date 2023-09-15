export class EscapeToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Escape, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {EscapeToken}
     */
    static assert(token) {
        return /** @type {EscapeToken} */ assertTokenType(token, JSONTokenType.Escape);
    }

    evaluate() {
        let str = null;
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                if (str !== null) {
                    throw new Error('Unexpected extra code point in escape token');
                }

                const character = child.evaluate();
                if (character === '"' || character === '\\' || character === '/') {
                    str = character;
                } else if (character === 'b') {
                    str = '\b';
                } else if (character === 'f') {
                    str = '\f';
                } else if (character === 'n') {
                    str = '\n';
                } else if (character === 'r') {
                    str = '\r';
                } else if (character === 't') {
                    str = '\t';
                } else {
                    throw new Error(`Unexpected code point "${character}" in escape sequence`);
                }
            } else if (child.type === JSONTokenType.Hex) {
                if (str !== null) {
                    throw new Error('Unexpected extra unicode hex sequence in escape token');
                }

                str = child.evaluate();
            } else {
                throw new Error('Unexpected token in unicode hex sequence');
            }
        }

        if (str === null) {
            throw new Error('No code point or unicode hex sequence in escape token');
        }

        return str;
    }

    async write(streamWriter) {
        await streamWriter.writeString('\\');
        await super.write(streamWriter);
    }
}