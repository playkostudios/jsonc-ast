import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';
import { CodePointsToken } from './CodePointsToken.js';

export class NumberToken extends JSONParentToken<JSONTokenType.Number> implements JSONValueToken {
    constructor() {
        super(JSONTokenType.Number);
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): NumberToken {
        return assertTokenType(token, JSONTokenType.Number);
    }

    static fromNumber(num: number) {
        if (!isFinite(num)) {
            throw new Error("Can't encode Infinity in JSON");
        } else if (isNaN(num)) {
            throw new Error("Can't encode NaN in JSON");
        }

        return NumberToken.fromString(num.toString());
    }

    static fromString(str: string) {
        const token = new NumberToken();
        token.children.push(CodePointsToken.fromString(str));
        return token;
    }

    evaluate() {
        const parts = [];
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                parts.push((child as CodePointsToken).evaluate());
            } else {
                throw new Error('Unexpected token in number');
            }
        }

        return Number(parts.join(''));
    }
}