import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';
import { evalStringLikeToken } from '../util/evalStringLikeToken.js';
import { CodePointsToken } from './CodePointsToken.js';

export class StringToken extends JSONParentToken<JSONTokenType.String> implements JSONValueToken {
    constructor() {
        super(JSONTokenType.String);
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): StringToken {
        return assertTokenType(token, JSONTokenType.String);
    }

    static fromString(str: string) {
        const token = new StringToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        return token;
    }

    evaluate() {
        return evalStringLikeToken('string', this);
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('"');
        await super.write(streamWriter);
        await streamWriter.writeString('"');
    }
}