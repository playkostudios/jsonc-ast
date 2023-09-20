import { type JSONParentToken } from '../base/JSONParentToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { CodePointsToken } from '../tokens/CodePointsToken.js';
import { EscapeToken } from '../tokens/EscapeToken.js';

export function evalStringLikeToken<T extends JSONTokenType>(tokenName: string, token: JSONParentToken<T>) {
    const parts = [];
    for (const child of token.children) {
        if (child.type === JSONTokenType.CodePoints || child.type === JSONTokenType.Escape) {
            parts.push((child as (CodePointsToken | EscapeToken)).evaluate());
        } else {
            throw new Error(`Unexpected token in ${tokenName}`);
        }
    }

    return parts.join('');
}