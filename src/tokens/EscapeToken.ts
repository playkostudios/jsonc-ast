import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';
import { type CodePointsToken } from './CodePointsToken.js';
import { type HexToken } from './HexToken.js';

export class EscapeToken extends JSONParentToken<JSONTokenType.Escape> implements JSONValueToken {
    constructor() {
        super(JSONTokenType.Escape);
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): EscapeToken {
        return assertTokenType(token, JSONTokenType.Escape);
    }

    evaluate() {
        let str = null;
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                if (str !== null) {
                    throw new Error('Unexpected extra code point in escape token');
                }

                const character = (child as CodePointsToken).evaluate();
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

                str = (child as HexToken).evaluate();
            } else {
                throw new Error('Unexpected token in unicode hex sequence');
            }
        }

        if (str === null) {
            throw new Error('No code point or unicode hex sequence in escape token');
        }

        return str;
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('\\');
        await super.write(streamWriter);
    }
}