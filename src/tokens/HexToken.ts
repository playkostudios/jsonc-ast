import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';
import { type CodePointsToken } from './CodePointsToken.js';

export class HexToken extends JSONParentToken<JSONTokenType.Hex> implements JSONValueToken {
    constructor() {
        super(JSONTokenType.Hex);
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): HexToken {
        return assertTokenType(token, JSONTokenType.Hex);
    }

    evaluate() {
        const parts = [];
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                parts.push((child as CodePointsToken).evaluate());
            } else {
                throw new Error('Unexpected token in unicode hex sequence');
            }
        }

        if (parts.length !== 4) {
            throw new Error(`Expected 4 code points in unicode hex sequence, got ${parts.length}`);
        }

        return String.fromCodePoint(Number.parseInt(parts.join(''), 16));
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('u');
        await super.write(streamWriter);
    }
}