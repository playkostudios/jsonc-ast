import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { assertTokenType } from '../util/assertTokenType';

export class CommaToken extends JSONToken<JSONTokenType.Comma> {
    constructor() {
        super(JSONTokenType.Comma);
    }

    override get children(): null {
        return null;
    }

    override get isValue(): false {
        return false;
    }

    static assert(token: JSONToken): CommaToken {
        return assertTokenType(token, JSONTokenType.Comma);
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString(',');
    }
}