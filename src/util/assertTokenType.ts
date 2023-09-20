import { JSONToken } from '../base/JSONToken.js';
import { JSONTokenTypeNames } from '../base/JSONTokenTypeNames.js';

export function assertTokenType<WantedTokenType extends JSONToken = JSONToken>(token: JSONToken, type: WantedTokenType['type']): WantedTokenType {
    if (token.type !== type) {
        throw new Error(`Expected token type "${JSONTokenTypeNames[type]}", got "${JSONTokenTypeNames[token.type]}"`);
    }

    return token as WantedTokenType;
}