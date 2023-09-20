import { ArrayToken } from '../tokens/ArrayToken.js';
import { FalseToken } from '../tokens/FalseToken.js';
import { NullToken } from '../tokens/NullToken.js';
import { NumberToken } from '../tokens/NumberToken.js';
import { ObjectToken } from '../tokens/ObjectToken.js';
import { StringToken } from '../tokens/StringToken.js';
import { TrueToken } from '../tokens/TrueToken.js';

export function valueToToken(value: unknown) {
    if (value === undefined) {
        throw new Error("Can't encode undefined in JSON");
    } else if (value === null) {
        return new NullToken();
    } else if (value === true) {
        return new TrueToken();
    } else if (value === false) {
        return new FalseToken();
    } else {
        const type = typeof value;
        if (type === 'string') {
            return StringToken.fromString(value as string);
        } else if (type === 'number') {
            return NumberToken.fromNumber(value as number);
        } else if (Array.isArray(value)) {
            return ArrayToken.fromArray(value);
        } else {
            return ObjectToken.fromObject(value as Record<string, unknown>);
        }
    }
}