import { type StreamWriter } from '../util/StreamWriter';
import { JSONToken } from '../base/JSONToken';
import { JSONTokenType } from '../base/JSONTokenType';
import { type JSONValueToken } from '../base/JSONValueToken';
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