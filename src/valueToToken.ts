export function valueToToken(value) {
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
            return StringToken.fromString(value);
        } else if (type === 'number') {
            return NumberToken.fromNumber(value);
        } else if (Array.isArray(value)) {
            return ArrayToken.fromArray(value);
        } else {
            return ObjectToken.fromObject(value);
        }
    }
}