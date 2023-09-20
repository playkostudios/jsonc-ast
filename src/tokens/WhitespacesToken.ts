import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { assertTokenType } from '../util/assertTokenType.js';
import { CodePointsToken } from './CodePointsToken.js';

export class WhitespacesToken extends JSONParentToken<JSONTokenType.Whitespaces> {
    constructor() {
        super(JSONTokenType.Whitespaces);
    }

    override get isValue(): false {
        return false;
    }

    static assert(token: JSONToken): WhitespacesToken {
        return assertTokenType(token, JSONTokenType.Whitespaces);
    }

    static fromString(str: string) {
        const token = new WhitespacesToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        return token;
    }

    getCodePointsToken() {
        // FIXME this is a bad method. it should return a list of codepoints
        //       tokens, not one
        let token: CodePointsToken | null = null;
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                if (token) {
                    throw new Error('Multiple code point tokens in key');
                }

                token = child as CodePointsToken;
            } else if (child.type !== JSONTokenType.MultiLineComment && child.type !== JSONTokenType.SingleLineComment) {
                throw new Error('Unexpected token in key');
            }
        }

        if (token === null) {
            throw new Error('No code point token in key');
        }

        return token;
    }

    guessIndent() {
        try {
            const wsStr = this.getCodePointsToken().evaluate();
            return wsStr.substring(wsStr.lastIndexOf('\n') + 1).length;
        } catch(_err) {
            return 0;
        }
    }
}