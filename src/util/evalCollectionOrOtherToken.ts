import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { type ArrayToken } from '../tokens/ArrayToken.js';
import { type ObjectToken } from '../tokens/ObjectToken.js';

export function evalCollectionOrOtherToken(valToken: JSONValueToken, allowTrailingCommas: boolean): unknown {
    if (valToken.type === JSONTokenType.Object) {
        return (valToken as ObjectToken).evaluate(allowTrailingCommas);
    } else if (valToken.type === JSONTokenType.Array) {
        return (valToken as ArrayToken).evaluate(allowTrailingCommas);
    } else {
        return valToken.evaluate();
    }
}