import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';

export class TrueToken extends JSONToken<JSONTokenType.True> implements JSONValueToken {
    constructor() {
        super(JSONTokenType.True);
    }

    override get children(): null {
        return null;
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): TrueToken {
        return assertTokenType(token, JSONTokenType.True);
    }

    evaluate() {
        return true;
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('true');
    }
}