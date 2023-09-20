import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';

export class NullToken extends JSONToken<JSONTokenType.Null> implements JSONValueToken {
    constructor() {
        super(JSONTokenType.Null);
    }

    override get children(): null {
        return null;
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): NullToken {
        return assertTokenType(token, JSONTokenType.Null);
    }

    evaluate() {
        return null;
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('null');
    }
}