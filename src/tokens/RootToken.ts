import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';

export class RootToken extends JSONParentToken<JSONTokenType.Root> {
    constructor() {
        super(JSONTokenType.Root);
    }

    override get isValue(): false {
        return false;
    }

    static assert(token: JSONToken): RootToken {
        return assertTokenType(token, JSONTokenType.Root);
    }

    getValueToken(): JSONValueToken {
        let token: JSONValueToken | null = null;
        for (const child of this.children) {
            if (child.isValue) {
                if (token) {
                    throw new Error('Multiple value tokens in root');
                }

                token = child as JSONValueToken;
            } else if (child.type !== JSONTokenType.Whitespaces) {
                throw new Error('Unexpected non-whitespace token in root');
            }
        }

        if (token === null) {
            throw new Error('No value token in root');
        }

        return token;
    }

    getValue() {
        return this.getValueToken().evaluate();
    }
}