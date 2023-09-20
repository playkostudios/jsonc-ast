import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { assertTokenType } from '../util/assertTokenType.js';
import { CodePointsToken } from './CodePointsToken.js';
import { WhitespacesToken } from './WhitespacesToken.js';

export class SingleLineCommentToken extends JSONParentToken<JSONTokenType.SingleLineComment> {
    constructor() {
        super(JSONTokenType.SingleLineComment);
    }

    override get isValue(): false {
        return false;
    }

    static assert(token: JSONToken): SingleLineCommentToken {
        return assertTokenType(token, JSONTokenType.SingleLineComment);
    }

    static wrapFromString(str: string) {
        const token = new SingleLineCommentToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        const wsToken = new WhitespacesToken();
        wsToken.children.push(token);
        return wsToken;
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('//');
        await super.write(streamWriter);
    }
}