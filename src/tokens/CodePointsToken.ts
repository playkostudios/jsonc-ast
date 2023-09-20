import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';

export class CodePointsToken extends JSONToken<JSONTokenType.CodePoints> implements JSONValueToken {
    constructor(readonly codePoints: Array<number>) {
        super(JSONTokenType.CodePoints);
    }

    override get children(): null {
        return null;
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): CodePointsToken {
        return assertTokenType(token, JSONTokenType.CodePoints);
    }

    static fromCodePoint(codePoint: number) {
        return new CodePointsToken([codePoint]);
    }

    static fromString(str: string) {
        const codePoints = [];
        for (const codePointStr of str) {
            codePoints.push(codePointStr.codePointAt(0)!);
        }

        if (codePoints.length === 0) {
            throw new Error('Empty string');
        }

        return new CodePointsToken(codePoints);
    }

    evaluate() {
        return String.fromCodePoint(...this.codePoints);
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeCodePoints(this.codePoints);
    }

    dump(depth = 0) {
        const parts = [`${'    '.repeat(depth)}<"`];

        for (const charStr of this.evaluate()) {
            switch (charStr) {
                case '\n':
                    parts.push('\\n');
                    break;
                case '\t':
                    parts.push('\\t');
                    break;
                case '\r':
                    parts.push('\\r');
                    break;
                case '"':
                case '\\':
                case '>':
                case '<':
                    parts.push('\\');
                    // falls through
                default:
                    parts.push(charStr);
            }
        }

        parts.push('">');
        console.debug(parts.join(''));
    }
}