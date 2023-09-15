import { JSONToken } from './JSONToken';
import { JSONTokenType } from './JSONTokenType';
import { JSONTokenTypeNames } from './JSONTokenTypeNames';

export function assertTokenType(token: JSONToken, type: JSONTokenType) {
    if (token.type !== type) {
        throw new Error(`Expected token type "${JSONTokenTypeNames[type]}", got "${JSONTokenTypeNames[token.type]}"`);
    }

    return token;
}