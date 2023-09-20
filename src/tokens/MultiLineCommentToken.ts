import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { assertTokenType } from '../util/assertTokenType.js';
import { CodePointsToken } from './CodePointsToken.js';
import { WhitespacesToken } from './WhitespacesToken.js';

export class MultiLineCommentToken extends JSONParentToken<JSONTokenType.MultiLineComment> {
    constructor() {
        super(JSONTokenType.MultiLineComment);
    }

    override get isValue(): false {
        return false;
    }

    static assert(token: JSONToken): MultiLineCommentToken {
        return assertTokenType(token, JSONTokenType.MultiLineComment);
    }

    static wrapFromString(str: string) {
        const token = new MultiLineCommentToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        const wsToken = new WhitespacesToken();
        wsToken.children.push(token);
        return wsToken;
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('/*');
        await super.write(streamWriter);
        await streamWriter.writeString('*/');
    }
}