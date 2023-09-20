import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { assertTokenType } from '../util/assertTokenType.js';
import { evalStringLikeToken } from '../util/evalStringLikeToken.js';
import { CodePointsToken } from './CodePointsToken.js';

export class KeyToken extends JSONParentToken<JSONTokenType.Key> {
    constructor() {
        super(JSONTokenType.Key);
    }

    override get isValue(): false {
        return false;
    }

    static assert(token: JSONToken): KeyToken {
        return assertTokenType(token, JSONTokenType.Key);
    }

    static fromString(str: string) {
        if (str === '') {
            throw new Error("Keys can't be empty");
        }

        const token = new KeyToken();
        token.children.push(CodePointsToken.fromString(str));
        return token;
    }

    getString() {
        return evalStringLikeToken('key', this);
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('"');
        await super.write(streamWriter);
        await streamWriter.writeString('"');
    }
}