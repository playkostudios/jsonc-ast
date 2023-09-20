import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';

export class FalseToken extends JSONToken<JSONTokenType.False> implements JSONValueToken {
    constructor() {
        super(JSONTokenType.False);
    }

    override get children(): null {
        return null;
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): FalseToken {
        return assertTokenType(token, JSONTokenType.False);
    }

    evaluate() {
        return false;
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('false');
    }
}