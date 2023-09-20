import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { assertTokenType } from '../util/assertTokenType.js';

export class ColonToken extends JSONToken<JSONTokenType.Colon> {
    constructor() {
        super(JSONTokenType.Colon);
    }

    override get children(): null {
        return null;
    }

    override get isValue(): false {
        return false;
    }

    static assert(token: JSONToken): ColonToken {
        return assertTokenType(token, JSONTokenType.Colon);
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString(':');
    }
}