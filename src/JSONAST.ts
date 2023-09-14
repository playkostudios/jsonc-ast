import { createReadStream, createWriteStream } from 'node:fs';
import { JsonLow } from '@xtao-org/jsonhilo';
import { Utf8bs2c, Utf8c2bs } from 'utf8x2x';
import { JsonCLow, _asterisk_ } from './JsonCLow.js';

export class StreamWriter {
    constructor(path) {
        this.stream = createWriteStream(path, { encoding: 'binary' });
        this.stream.on('error', (err) => {
            const stream = this.stream;
            this.stream = null;
            this.err = err;
            stream.close();
        })
        this.queuedChunks = [];
        this.c2b = Utf8c2bs({
            bytes: (byteArray) => {
                this.queuedChunks.push(new Uint8Array(byteArray));
            }
        }).codePoint;
    }

    writeChunk(chunk) {
        if (this.stream) {
            this.stream.write(chunk);
        } else {
            throw new Error('Stream unavailable');
        }
    }

    async flushChunks() {
        for (const chunk of this.queuedChunks) {
            this.writeChunk(chunk);
        }

        this.queuedChunks.length = 0;
    }

    queueCodePoint(codePoint) {
        this.c2b(codePoint);
    }

    async writeCodePoint(codePoint) {
        this.queueCodePoint(codePoint);
        await this.flushChunks();
    }

    async writeCodePoints(codePoints) {
        for (const codePoint of codePoints) {
            this.c2b(codePoint);
        }
        await this.flushChunks();
    }

    async writeString(str) {
        for (const codePointStr of str) {
            this.queueCodePoint(codePointStr.codePointAt(0));
        }
        await this.flushChunks();
    }

    close() {
        const stream = this.stream;
        this.stream = null;

        return new Promise((resolve, reject) => {
            if (stream) {
                stream.close((err) => {
                    if (err === null || err === undefined) {
                        resolve();
                    } else {
                        reject(err);
                    }
                });
            } else {
                reject(this.err);
            }
        })
    }
}

/** @enum {0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16} */
export const JSONTokenType = {
    /** @type {0}  */ Root: 0,
    /** @type {1}  */ Object: 1,
    /** @type {2}  */ Array: 2,
    /** @type {3}  */ String: 3,
    /** @type {4}  */ Number: 4,
    /** @type {5}  */ True: 5,
    /** @type {6}  */ False: 6,
    /** @type {7}  */ Null: 7,
    /** @type {8}  */ Key: 8,
    /** @type {9}  */ Hex: 9,
    /** @type {10} */ CodePoints: 10,
    /** @type {11} */ Escape: 11,
    /** @type {12} */Whitespaces: 12,
    /** @type {13} */Comma: 13,
    /** @type {14} */Colon: 14,
    /** @type {15} */SingleLineComment: 15,
    /** @type {16} */MultiLineComment: 16,
};

export const JSONTokenTypeNames = [
    'Root',
    'Object',
    'Array',
    'String',
    'Number',
    'True',
    'False',
    'Null',
    'Key',
    'Hex',
    'CodePoints',
    'Escape',
    'Whitespaces',
    'Comma',
    'Colon',
    'SingleLineComment',
    'MultiLineComment',
];

/**
 * @param {JSONToken} token
 * @param {JSONTokenType} type
 */
export function assertTokenType(token, type) {
    if (token.type !== type) {
        throw new Error(`Expected token type "${JSONTokenTypeNames[type]}", got "${JSONTokenTypeNames[token.type]}"`);
    }

    return token;
}

export class JSONToken {
    constructor(type, canHaveChildren) {
        this.type = type;

        if (canHaveChildren) {
            this.children = [];
        }
    }

    get isValue() {
        return false;
    }

    get canHaveChildren() {
        return !!this.children;
    }

    async write(streamWriter) {
        if (this.canHaveChildren) {
            for (const child of this.children) {
                await child.write(streamWriter);
            }
        }
    }

    replaceChild(oldChild, newChild) {
        const idx = this.children.indexOf(oldChild);
        if (idx < 0) {
            throw new Error('Child token not found');
        }

        this.children.splice(idx, 1, newChild);
    }

    dump(depth = 0) {
        const name = JSONTokenTypeNames[this.type];
        const indent = '    '.repeat(depth);

        if (this.canHaveChildren && this.children.length > 0) {
            console.debug(`${indent}<${name}>`);

            for (const child of this.children) {
                child.dump(depth + 1);
            }

            console.debug(`${indent}</${name}>`);
        } else {
            console.debug(`${indent}<${name}/>`);
        }
    }
}

export class JSONValueToken extends JSONToken {
    static fromValue(value) {
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

    get isValue() {
        return true;
    }

    evaluate() {
        throw new Error('Not implemented');
    }
}

export class RootToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Root, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {RootToken}
     */
    static assert(token) {
        return /** @type {RootToken} */ (assertTokenType(token, JSONTokenType.Root));
    }

    /** @returns {JSONValueToken} */
    getValueToken() {
        let token = null;
        for (const child of this.children) {
            if (child.isValue) {
                if (token) {
                    throw new Error('Multiple value tokens in root');
                }

                token = child;
            } else if (child.type !== JSONTokenType.Whitespaces) {
                throw new Error('Unexpected non-whitespace token in root');
            }
        }

        if (token === null) {
            throw new Error('No value token in root');
        }

        return token;
    }

    getValue() {
        return this.getValueToken().evaluate();
    }
}

export class ObjectToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Object, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {ObjectToken}
     */
    static assert(token) {
        return /** @type {ObjectToken} */ (assertTokenType(token, JSONTokenType.Object));
    }

    static fromObject(obj) {
        const token = new ObjectToken();
        const children = token.children;
        let first = true;

        for (const key of Object.getOwnPropertyNames(obj)) {
            if (first) {
                first = false;
            } else {
                children.push(new CommaToken());
            }

            children.push(
                KeyToken.fromString(key),
                new ColonToken(),
                JSONValueToken.fromValue(obj[key]),
            );
        }

        return token;
    }

    /** @returns {Record<string, unknown>} */
    evaluate() {
        const obj = {};
        let expectedToken = JSONTokenType.Key;
        let needsKey = false;
        let key = null;

        for (const child of this.children) {
            const type = child.type;
            if (type === JSONTokenType.Whitespaces) {
                continue;
            } else if (expectedToken !== null && type !== expectedToken) {
                throw new Error('Unexpected token in object');
            } else if (expectedToken === null && type === JSONTokenType.Key) {
                throw new Error('Unexpected key as value in object');
            }

            if (type === JSONTokenType.Key) {
                needsKey = false;
                key = child.getString();
                expectedToken = JSONTokenType.Colon;
            } else if (type === JSONTokenType.Colon) {
                expectedToken = null;
            } else if (expectedToken === null) {
                if (!child.isValue) {
                    throw new Error('Non-value token as value in object');
                }

                const value = child.evaluate();
                expectedToken = JSONTokenType.Comma;
                obj[key] = value;
            } else if (expectedToken === JSONTokenType.Comma) {
                expectedToken = JSONTokenType.Key;
                needsKey = true;
            }
        }

        if (needsKey) {
            throw new Error('Dangling comma in object');
        } else if (expectedToken !== JSONTokenType.Key && expectedToken !== JSONTokenType.Comma) {
            throw new Error('Malformed object');
        }

        return obj;
    }

    /**
     * @param {string} key
     * @returns {JSONValueToken | boolean}
     */
    maybeGetValueTokenOfKeyOrHasKeys(key) {
        let expectedToken = JSONTokenType.Key;
        let match = false;
        let hadKeys = false;

        for (const child of this.children) {
            const type = child.type;
            if (type === JSONTokenType.Whitespaces) {
                continue;
            } else if (expectedToken !== null && type !== expectedToken) {
                throw new Error('Unexpected token in object');
            } else if (expectedToken === null && type === JSONTokenType.Key) {
                throw new Error('Unexpected key as value in object');
            }

            if (type === JSONTokenType.Key) {
                hadKeys = true;

                if (key === child.getString()) {
                    match = true;
                }

                expectedToken = JSONTokenType.Colon;
            } else if (type === JSONTokenType.Colon) {
                expectedToken = null;
            } else if (expectedToken === null) {
                if (!child.isValue) {
                    throw new Error('Non-value token as value in object');
                }

                if (match) {
                    return child;
                }

                expectedToken = JSONTokenType.Comma;
            } else if (expectedToken === JSONTokenType.Comma) {
                expectedToken = JSONTokenType.Key;
            }
        }

        return hadKeys;
    }

    /**
     * @param {string} key
     * @returns {JSONValueToken | null}
     */
    maybeGetValueTokenOfKey(key) {
        const token = this.maybeGetValueTokenOfKeyOrHasKeys(key);
        if (token === true || token === false) {
            return null;
        } else {
            return token;
        }
    }

    /**
     * @param {string} key
     * @returns {JSONValueToken}
     */
    getValueTokenOfKey(key) {
        const token = this.maybeGetValueTokenOfKey(key);
        if (token === null) {
            throw new Error(`Object has no key "${key}"`);
        } else {
            return token;
        }
    }

    /**
     * @param {string} key
     * @returns {unknown}
     */
    maybeGetValueOfKey(key) {
        const token = this.maybeGetValueTokenOfKey(key);
        if (token) {
            return token.evaluate();
        } else {
            return;
        }
    }

    /**
     * @param {string} key
     * @returns {unknown}
     */
    getValueOfKey(key) {
        return this.getValueTokenOfKey(key).evaluate();
    }

    /**
     * @param {string} key
     * @param {unknown} value
     * @param {number} indent
     */
    setValueOfKey(key, value, indent = 0) {
        const token = this.maybeGetValueTokenOfKeyOrHasKeys(key);
        if (token === true || token === false) {
            let idx = this.getEndIdx();
            if (token) {
                this.children.splice(idx, 0, new CommaToken());
                idx++;
            }

            if (indent !== 0) {
                this.children.splice(
                    idx, 0,
                    WhitespacesToken.fromString(`\n${' '.repeat(indent)}`)
                );
                idx++;
            }

            this.children.splice(
                idx, 0,
                KeyToken.fromString(key),
                new ColonToken(),
                WhitespacesToken.fromString(' '),
                JSONValueToken.fromValue(value),
            );

            return true;
        } else {
            const curValue = token.evaluate();
            if (curValue !== value) {
                this.replaceChild(token, JSONValueToken.fromValue(value));
                return true;
            }
        }

        return false;
    }

    /**
     * @returns {Array<[key: string, value: JSONValueToken]>}
     */
    getTokenEntries() {
        const entries = [];
        let expectedToken = JSONTokenType.Key;
        let key = null;

        for (const child of this.children) {
            const type = child.type;
            if (type === JSONTokenType.Whitespaces) {
                continue;
            } else if (expectedToken !== null && type !== expectedToken) {
                throw new Error('Unexpected token in object');
            } else if (expectedToken === null && type === JSONTokenType.Key) {
                throw new Error('Unexpected key as value in object');
            }

            if (type === JSONTokenType.Key) {
                key = child.getString();
                expectedToken = JSONTokenType.Colon;
            } else if (type === JSONTokenType.Colon) {
                expectedToken = null;
            } else if (expectedToken === null) {
                if (!child.isValue) {
                    throw new Error('Non-value token as value in object');
                }

                entries.push([key, child]);
                expectedToken = JSONTokenType.Comma;
            } else if (expectedToken === JSONTokenType.Comma) {
                expectedToken = JSONTokenType.Key;
            }
        }

        if (expectedToken === JSONTokenType.Comma || (expectedToken === JSONTokenType.Key && key === null)) {
            return entries;
        } else {
            throw new Error('Unexpected early end of object');
        }
    }

    /**
     * @param {string} key
     * @returns {JSONValueToken | boolean}
     */
    deleteKey(key) {
        let expectedToken = JSONTokenType.Key;
        let lastCommaIdx = null;
        let deleteStart = -1;
        let deleteEnd = -1;
        const tkChildren = this.children;
        const tkChildCount = tkChildren.length;

        for (let t = 0; t < tkChildCount; t++) {
            const child = tkChildren[t];
            const type = child.type;
            if (type === JSONTokenType.Whitespaces) {
                continue;
            } else if (expectedToken !== null && type !== expectedToken) {
                throw new Error('Unexpected token in object');
            } else if (expectedToken === null && type === JSONTokenType.Key) {
                throw new Error('Unexpected key as value in object');
            }

            if (type === JSONTokenType.Key) {
                if (deleteStart !== -1) {
                    deleteEnd = t;
                    break;
                } else if (key === child.getString()) {
                    deleteStart = lastCommaIdx === null ? t : lastCommaIdx;
                }

                expectedToken = JSONTokenType.Colon;
            } else if (type === JSONTokenType.Colon) {
                expectedToken = null;
            } else if (expectedToken === null) {
                if (!child.isValue) {
                    throw new Error('Non-value token as value in object');
                }

                expectedToken = JSONTokenType.Comma;
            } else if (expectedToken === JSONTokenType.Comma) {
                expectedToken = JSONTokenType.Key;

                if (deleteStart !== -1 && lastCommaIdx !== null) {
                    deleteEnd = t;
                    break;
                }

                lastCommaIdx = t;
            }
        }

        if (deleteStart === -1) {
            return false;
        } else {
            if (deleteEnd === -1) {
                deleteEnd = this.getEndIdx();
            }

            tkChildren.splice(deleteStart, deleteEnd - deleteStart);
            return true;
        }
    }

    /**
     * @returns {number}
     */
    guessKeyIndent() {
        let keyIndent = 0;
        const childCount = this.children.length;

        for (let c = 1; c < childCount; c++) {
            const child = this.children[c];
            if (child.type === JSONTokenType.Key) {
                const prevChild = this.children[c - 1];
                if (prevChild.type === JSONTokenType.Whitespaces) {
                    keyIndent = prevChild.guessIndent();
                    break;
                }
            }
        }

        return keyIndent;
    }

    isEmpty() {
        for (const child of this.children) {
            if (child.type !== JSONTokenType.Whitespaces) {
                return false;
            }
        }

        return true;
    }

    compactIfEmpty() {
        if (this.isEmpty()) {
            this.children.length = 0;
        }
    }

    /**
     * @returns {number}
     */
    getEndIdx() {
        for (let c = this.children.length - 1; c >= 0; c--) {
            const child = this.children[c];
            if (child.type !== JSONTokenType.Whitespaces) {
                return c + 1;
            }
        }

        return 0;
    }

    async write(streamWriter) {
        await streamWriter.writeString('{');
        await super.write(streamWriter);
        await streamWriter.writeString('}');
    }
}

export class ArrayToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Array, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {ArrayToken}
     */
    static assert(token) {
        return /** @type {ArrayToken} */ assertTokenType(token, JSONTokenType.Array);
    }

    static fromArray(arr) {
        const token = new ArrayToken();
        const children = token.children;
        let first = true;

        for (const value of arr) {
            if (first) {
                first = false;
            } else {
                children.push(new CommaToken());
            }

            children.push(JSONValueToken.fromValue(value));
        }

        return token;
    }

    /** @returns {Array<JSONValueToken>} */
    getTokenEntries() {
        const arr = [];
        let expectedToken = null;
        let needsValue = false;

        for (const child of this.children) {
            const type = child.type;
            if (type === JSONTokenType.Whitespaces) {
                continue;
            } else if (expectedToken !== null && type !== expectedToken) {
                throw new Error('Unexpected token in array');
            }

            if (expectedToken === null) {
                if (!child.isValue) {
                    throw new Error('Non-value token as value in array');
                }

                expectedToken = JSONTokenType.Comma;
                arr.push(child);
                needsValue = false;
            } else if (expectedToken === JSONTokenType.Comma) {
                expectedToken = null;
                needsValue = true;
            }
        }

        if (needsValue) {
            throw new Error('Dangling comma in array');
        }

        return arr;
    }

    /**
     * @returns {number}
     */
    guessValueIndent() {
        let indent = 0;
        const childCount = this.children.length;

        for (let c = 1; c < childCount; c++) {
            const child = this.children[c];
            if (child.isValue) {
                const prevChild = this.children[c - 1];
                if (prevChild.type === JSONTokenType.Whitespaces) {
                    indent = prevChild.guessIndent();
                    break;
                }
            }
        }

        return indent;
    }

    /**
     * @param {number} tkIdx
     * @param {Array<JSONValueToken>} items
     * @param {number} off
     * @param {number | null | undefined} indentation
     */
    inlineInsert(tkIdx, items, off, indentation = null) {
        const itemCount = items.length;
        if (itemCount - off > 0) {
            return;
        }

        if (indentation === null) {
            indentation = this.guessValueIndent();
        }

        const extraTokens = [];
        const insertCount = items.length;
        for (let i = off; i < insertCount; i++) {
            extraTokens.push(
                new CommaToken(),
                WhitespacesToken.fromString(`\n${' '.repeat(indentation)}`),
                items[i],
            );
        }

        this.children.splice(tkIdx, 0, ...extraTokens);
    }

    /**
     * @param {Array<JSONValueToken>} items
     * @param {number} off
     * @param {number | null | undefined} indentation
     */
    pushArr(items, off, indentation = null) {
        const itemCount = items.length;
        if (itemCount - off > 0) {
            return;
        }

        // find last value token and do inline insert if found
        const tkChildren = this.children;
        const tkChildCount = tkChildren.length;
        for (let t = tkChildCount - 1; t >= 0; t--) {
            if (tkChildren[t].isValue) {
                this.inlineInsert(t + 1, items, off, indentation);
                return;
            }
        }

        // no items in array
        tkChildren.push(items[0]);
        this.inlineInsert(tkChildCount + 1, items, off + 1, indentation);
    }

    /**
     * @param {Array<JSONValueToken>} items
     */
    push(...items) {
        this.pushArr(items);
    }

    /**
     * @param {number} start
     * @param {number} deleteCount
     * @param {Array<JSONValueToken>} items
     * @returns {Array<JSONValueToken>} An array with all the tokens that were removed
     */
    splice(start, deleteCount, ...items) {
        if (start < 0) {
            throw new Error('Negative start index not supported');
        }

        let insertCount = items.length;
        let insertIdx = 0;
        let expectedToken = null;
        let needsValue = false;
        const indentation = this.guessValueIndent();
        const deleted = [];
        let deleteStart = -1;
        let deleteEnd = -1;
        let deleteNextComma = false;
        let lastCommaIdx = null;

        const tkChildren = this.children;
        const tkChildCount = tkChildren.length;
        for (let t = 0; t < tkChildCount; t++) {
            const child = this.children[t];
            const type = child.type;
            if (type === JSONTokenType.Whitespaces) {
                continue;
            } else if (expectedToken !== null && type !== expectedToken) {
                throw new Error('Unexpected token in array');
            }

            if (expectedToken === null) {
                if (!child.isValue) {
                    throw new Error('Non-value token as value in array');
                }

                needsValue = false;

                if (start > 0) {
                    start--;
                } else {
                    // we're at the target!
                    if (deleteCount > 0) {
                        deleteCount--;
                        deleted.push(child);

                        if (insertIdx < insertCount) {
                            // replace
                            this.children[t] = items[insertIdx++];
                        } else if (deleteStart === -1) {
                            // start deleting range
                            deleteNextComma = lastCommaIdx === null;
                            deleteStart = deleteNextComma ? t : lastCommaIdx;
                        }
                    } else {
                        if (deleteCount === 0 && deleteNextComma && deleteStart !== -1 && deleteEnd === -1) {
                            // end of deletion range
                            deleteEnd = t;
                        }

                        if (insertIdx < insertCount) {
                            // inline insert
                            this.inlineInsert(t + 1, items, insertIdx, indentation);
                            insertIdx = insertCount;
                            break;
                        }
                    }
                }

                expectedToken = JSONTokenType.Comma;
            } else if (expectedToken === JSONTokenType.Comma) {
                if (deleteCount === 0 && !deleteNextComma && deleteStart !== -1 && deleteEnd === -1) {
                    // end of deletion range
                    deleteEnd = t;
                }

                lastCommaIdx = t;
                expectedToken = null;
                needsValue = true;
            }
        }

        if (needsValue) {
            throw new Error('Dangling comma in array');
        }

        // actually delete deletion range
        if (deleteStart !== -1) {
            if (deleteEnd === -1) {
                deleteEnd = this.getEndIdx();
            }

            this.children.splice(deleteStart, deleteEnd - deleteStart);
        }

        // push remaining items to end of list
        if (insertIdx < insertCount) {
            this.pushArr(items, insertIdx, indentation);
        }

        return deleted;
    }

    evaluate() {
        const arr = [];
        let expectedToken = null;
        let needsValue = false;

        for (const child of this.children) {
            const type = child.type;
            if (type === JSONTokenType.Whitespaces) {
                continue;
            } else if (expectedToken !== null && type !== expectedToken) {
                throw new Error('Unexpected token in array');
            }

            if (expectedToken === null) {
                if (!child.isValue) {
                    throw new Error('Non-value token as value in array');
                }

                expectedToken = JSONTokenType.Comma;
                arr.push(child.evaluate());
                needsValue = false;
            } else if (expectedToken === JSONTokenType.Comma) {
                expectedToken = null;
                needsValue = true;
            }
        }

        if (needsValue) {
            throw new Error('Dangling comma in array');
        }

        return arr;
    }

    /**
     * @returns {number}
     */
    getEndIdx() {
        for (let c = this.children.length - 1; c >= 0; c--) {
            const child = this.children[c];
            if (child.type !== JSONTokenType.Whitespaces) {
                return c + 1;
            }
        }

        return 0;
    }

    async write(streamWriter) {
        await streamWriter.writeString('[');
        await super.write(streamWriter);
        await streamWriter.writeString(']');
    }
}

function evalStringLikeToken(tokenName, token) {
    const parts = [];
    for (const child of token.children) {
        if (child.type === JSONTokenType.CodePoints || child.type === JSONTokenType.Escape) {
            parts.push(child.evaluate());
        } else {
            throw new Error(`Unexpected token in ${tokenName}`);
        }
    }

    return parts.join('');
}

export class StringToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.String, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {StringToken}
     */
    static assert(token) {
        return /** @type {StringToken} */ assertTokenType(token, JSONTokenType.String);
    }

    static fromString(str) {
        const token = new StringToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        return token;
    }

    evaluate() {
        return evalStringLikeToken('string', this);
    }

    async write(streamWriter) {
        await streamWriter.writeString('"');
        await super.write(streamWriter);
        await streamWriter.writeString('"');
    }
}

export class NumberToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Number, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {NumberToken}
     */
    static assert(token) {
        return /** @type {NumberToken} */ assertTokenType(token, JSONTokenType.Number);
    }

    static fromNumber(num) {
        if (!isFinite(num)) {
            throw new Error("Can't encode Infinity in JSON");
        } else if (isNaN(num)) {
            throw new Error("Can't encode NaN in JSON");
        }

        return NumberToken.fromString(num.toString());
    }

    static fromString(str) {
        const token = new NumberToken();
        token.children.push(CodePointsToken.fromString(str));
        return token;
    }

    evaluate() {
        const parts = [];
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                parts.push(child.evaluate());
            } else {
                throw new Error('Unexpected token in number');
            }
        }

        return Number(parts.join(''));
    }
}

export class TrueToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.True, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {TrueToken}
     */
    static assert(token) {
        return /** @type {TrueToken} */ assertTokenType(token, JSONTokenType.True);
    }

    evaluate() {
        return true;
    }

    async write(streamWriter) {
        await streamWriter.writeString('true');
    }
}

export class FalseToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.False, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {FalseToken}
     */
    static assert(token) {
        return /** @type {FalseToken} */ assertTokenType(token, JSONTokenType.False);
    }

    evaluate() {
        return false;
    }

    async write(streamWriter) {
        await streamWriter.writeString('false');
    }
}

export class NullToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Null, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {NullToken}
     */
    static assert(token) {
        return /** @type {NullToken} */ assertTokenType(token, JSONTokenType.Null);
    }

    evaluate() {
        return null;
    }

    async write(streamWriter) {
        await streamWriter.writeString('null');
    }
}

export class KeyToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Key, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {KeyToken}
     */
    static assert(token) {
        return /** @type {KeyToken} */ assertTokenType(token, JSONTokenType.Key);
    }

    static fromString(str) {
        if (str === '') {
            throw new Error("Keys can't be empty");
        }

        const token = new KeyToken();
        token.children.push(CodePointsToken.fromString(str));
        return token;
    }

    getString() {
        return evalStringLikeToken('key', this);
    }

    async write(streamWriter) {
        await streamWriter.writeString('"');
        await super.write(streamWriter);
        await streamWriter.writeString('"');
    }
}

export class HexToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Hex, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {HexToken}
     */
    static assert(token) {
        return /** @type {HexToken} */ assertTokenType(token, JSONTokenType.Hex);
    }

    evaluate() {
        const parts = [];
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                parts.push(child.evaluate());
            } else {
                throw new Error('Unexpected token in unicode hex sequence');
            }
        }

        if (parts.length !== 4) {
            throw new Error(`Expected 4 code points in unicode hex sequence, got ${parts.length}`);
        }

        return String.fromCodePoint(Number.parseInt(parts.join(''), 16));
    }

    async write(streamWriter) {
        await streamWriter.writeString('u');
        await super.write(streamWriter);
    }
}

export class CodePointsToken extends JSONValueToken {
    constructor(codePoints) {
        super(JSONTokenType.CodePoints, false);
        this.codePoints = codePoints;
    }

    /**
     * @param {JSONToken} token
     * @returns {CodePointsToken}
     */
    static assert(token) {
        return /** @type {CodePointsToken} */ assertTokenType(token, JSONTokenType.CodePoints);
    }

    static fromCodePoint(codePoint) {
        return new CodePointsToken([codePoint]);
    }

    static fromString(str) {
        const codePoints = [];
        for (const codePointStr of str) {
            codePoints.push(codePointStr.codePointAt(0));
        }

        if (codePoints.length === 0) {
            throw new Error('Empty string');
        }

        return new CodePointsToken(codePoints);
    }

    evaluate() {
        return String.fromCodePoint(...this.codePoints);
    }

    async write(streamWriter) {
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

export class EscapeToken extends JSONValueToken {
    constructor() {
        super(JSONTokenType.Escape, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {EscapeToken}
     */
    static assert(token) {
        return /** @type {EscapeToken} */ assertTokenType(token, JSONTokenType.Escape);
    }

    evaluate() {
        let str = null;
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                if (str !== null) {
                    throw new Error('Unexpected extra code point in escape token');
                }

                const character = child.evaluate();
                if (character === '"' || character === '\\' || character === '/') {
                    str = character;
                } else if (character === 'b') {
                    str = '\b';
                } else if (character === 'f') {
                    str = '\f';
                } else if (character === 'n') {
                    str = '\n';
                } else if (character === 'r') {
                    str = '\r';
                } else if (character === 't') {
                    str = '\t';
                } else {
                    throw new Error(`Unexpected code point "${character}" in escape sequence`);
                }
            } else if (child.type === JSONTokenType.Hex) {
                if (str !== null) {
                    throw new Error('Unexpected extra unicode hex sequence in escape token');
                }

                str = child.evaluate();
            } else {
                throw new Error('Unexpected token in unicode hex sequence');
            }
        }

        if (str === null) {
            throw new Error('No code point or unicode hex sequence in escape token');
        }

        return str;
    }

    async write(streamWriter) {
        await streamWriter.writeString('\\');
        await super.write(streamWriter);
    }
}

export class WhitespacesToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Whitespaces, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {WhitespacesToken}
     */
    static assert(token) {
        return /** @type {WhitespacesToken} */ assertTokenType(token, JSONTokenType.Whitespaces);
    }

    static fromString(str) {
        const token = new WhitespacesToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        return token;
    }

    getCodePointsToken() {
        // FIXME this is a bad method. it should return a list of codepoints
        //       tokens, not one
        let token = null;
        for (const child of this.children) {
            if (child.type === JSONTokenType.CodePoints) {
                if (token) {
                    throw new Error('Multiple code point tokens in key');
                }

                token = child;
            } else if (child.type !== JSONTokenType.MultiLineComment && child.type !== JSONTokenType.SingleLineComment) {
                throw new Error('Unexpected token in key');
            }
        }

        if (token === null) {
            throw new Error('No code point token in key');
        }

        return token;
    }

    /** @returns {number} */
    guessIndent() {
        try {
            const wsStr = this.getCodePointsToken().evaluate();
            return wsStr.substring(wsStr.lastIndexOf('\n') + 1).length;
        } catch(_err) {
            return 0;
        }
    }
}

export class CommaToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Comma, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {CommaToken}
     */
    static assert(token) {
        return /** @type {CommaToken} */ assertTokenType(token, JSONTokenType.Comma);
    }

    async write(streamWriter) {
        await streamWriter.writeString(',');
    }
}

export class ColonToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Colon, false);
    }

    /**
     * @param {JSONToken} token
     * @returns {ColonToken}
     */
    static assert(token) {
        return /** @type {ColonToken} */ assertTokenType(token, JSONTokenType.Colon);
    }

    async write(streamWriter) {
        await streamWriter.writeString(':');
    }
}

export class SingleLineCommentToken extends JSONToken {
    constructor() {
        super(JSONTokenType.SingleLineComment, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {SingleLineCommentToken}
     */
    static assert(token) {
        return /** @type {SingleLineCommentToken} */ assertTokenType(token, JSONTokenType.SingleLineComment);
    }

    static wrapFromString(str) {
        const token = new SingleLineCommentToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        const wsToken = new WhitespacesToken();
        wsToken.children.push(token);
        return wsToken;
    }

    async write(streamWriter) {
        await streamWriter.writeString('//');
        await super.write(streamWriter);
    }
}

export class MultiLineCommentToken extends JSONToken {
    constructor() {
        super(JSONTokenType.MultiLineComment, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {MultiLineCommentToken}
     */
    static assert(token) {
        return /** @type {MultiLineCommentToken} */ assertTokenType(token, JSONTokenType.MultiLineComment);
    }

    static wrapFromString(str) {
        const token = new MultiLineCommentToken();
        if (str !== '') {
            token.children.push(CodePointsToken.fromString(str));
        }

        const wsToken = new WhitespacesToken();
        wsToken.children.push(token);
        return wsToken;
    }

    async write(streamWriter) {
        await streamWriter.writeString('/*');
        await super.write(streamWriter);
        await streamWriter.writeString('*/');
    }
}

export class JSONAST {
    constructor() {
        this.root = null;
        this.stack = [];
    }

    static async parseValue(path, allowComments) {
        const ast = new JSONAST();
        await ast.parse(path, allowComments);
        return ast.root.getValue();
    }

    get focus() {
        return this.stack[this.stack.length - 1];
    }

    pushToken(token) {
        const stackLen = this.stack.length;
        if (stackLen === 0) {
            if (this.root) {
                throw new Error('Nothing in stack, but root is set; possible bug');
            } else {
                this.root = token;
            }
        } else {
            this.stack[stackLen - 1].children.push(token);
        }

        if (token.canHaveChildren) {
            this.stack.push(token);
        }
    }

    pushCodePointTo(codePoint, parentToken) {
        const children = parentToken.children;
        const childCount = children.length;
        const lastChild = childCount === 0 ? null : children[childCount - 1];

        if (lastChild !== null && lastChild.type === JSONTokenType.CodePoints) {
            lastChild.codePoints.push(codePoint);
        } else {
            children.push(CodePointsToken.fromCodePoint(codePoint));
        }
    }

    pushCodePoint(codePoint) {
        if (!this.root) {
            throw new Error('No root token');
        }

        const stackLen = this.stack.length;
        if (stackLen === 0) {
            throw new Error('Nothing in stack, but root is set; possible bug');
        }

        this.pushCodePointTo(codePoint, this.stack[stackLen - 1]);
    }

    pushWhitespaceCodePoint(codePoint) {
        if (!this.root) {
            throw new Error('No root token');
        }

        const stackLen = this.stack.length;
        if (stackLen === 0) {
            throw new Error('Nothing in stack, but root is set; possible bug');
        }

        const children = this.stack[stackLen - 1].children;
        const childCount = children.length;
        const lastChild = childCount === 0 ? null : children[childCount - 1];

        if (lastChild !== null && lastChild.type === JSONTokenType.Whitespaces) {
            this.pushCodePointTo(codePoint, lastChild);
        } else {
            this.pushToken(new WhitespacesToken());
            this.pushToken(CodePointsToken.fromCodePoint(codePoint));
            this.popStack();
        }
    }

    pushWhitespaceToken(token, pop = true) {
        if (!this.root) {
            throw new Error('No root token');
        }

        const stackLen = this.stack.length;
        if (stackLen === 0) {
            throw new Error('Nothing in stack, but root is set; possible bug');
        }

        const children = this.stack[stackLen - 1].children;
        const childCount = children.length;
        const lastChild = childCount === 0 ? null : children[childCount - 1];

        if (lastChild !== null && lastChild.type === JSONTokenType.Whitespaces) {
            lastChild.children.push(token);
            if (!pop && token.canHaveChildren) {
                this.stack.push(lastChild, token);
            }
        } else {
            this.pushToken(new WhitespacesToken());
            this.pushToken(token);
            if (pop) {
                if (token.canHaveChildren) {
                    this.popStack();
                }
                this.popStack();
            }
        }
    }

    popStack() {
        if (this.stack.pop() === undefined) {
            throw new Error('Nothing in stack; is this a malformed JSON?');
        }
    }

    /** @returns {Promise<RootToken>} */
    parse(path, allowComments = false) {
        this.pushToken(new RootToken());
        let escapeNext = false;
        let escapeHex = false;
        let ignoreCodePoints = false;
        let mlAsterisk = false;

        return new Promise((resolve, reject) => {
            try {
                // open file for reading
                const parser = Utf8bs2c((allowComments ? JsonCLow : JsonLow)({
                    openObject: () => {
                        this.pushToken(new ObjectToken());
                    },
                    openArray: () => {
                        this.pushToken(new ArrayToken());
                    },
                    openString: () => {
                        this.pushToken(new StringToken());
                    },
                    openNumber: (codePoint) => {
                        this.pushToken(new NumberToken());
                        this.pushToken(CodePointsToken.fromCodePoint(codePoint));
                    },
                    openTrue: () => {
                        ignoreCodePoints = true;
                        this.pushToken(new TrueToken());
                    },
                    openFalse: () => {
                        ignoreCodePoints = true;
                        this.pushToken(new FalseToken());
                    },
                    openNull: () => {
                        ignoreCodePoints = true;
                        this.pushToken(new NullToken());
                    },
                    closeObject: () => {
                        this.popStack();
                    },
                    closeArray: () => {
                        this.popStack();
                    },
                    closeString: () => {
                        this.popStack();
                    },
                    closeNumber: () => {
                        this.popStack();
                    },
                    closeTrue: () => {
                        ignoreCodePoints = false;
                    },
                    closeFalse: () => {
                        ignoreCodePoints = false;
                    },
                    closeNull: () => {
                        ignoreCodePoints = false;
                    },
                    openKey: () => {
                        this.pushToken(new KeyToken());
                    },
                    openHex: () => {
                        if (escapeNext) {
                            escapeNext = false;
                            escapeHex = true;
                            this.pushToken(new EscapeToken());
                        }
                        this.pushToken(new HexToken());
                    },
                    closeKey: () => {
                        this.popStack();
                    },
                    closeHex: () => {
                        this.popStack();
                        if (escapeHex) {
                            escapeHex = false;
                            this.popStack();
                        }
                    },
                    codePoint: (codePoint) => {
                        if (ignoreCodePoints) {
                            return;
                        }

                        if (mlAsterisk) {
                            mlAsterisk = false;
                            this.pushCodePoint(_asterisk_);
                        }

                        if (escapeNext) {
                            this.pushToken(new EscapeToken());
                        }
                        this.pushCodePoint(codePoint);
                        if (escapeNext) {
                            escapeNext = false;
                            this.popStack();
                        }
                    },
                    escape: () => {
                        escapeNext = true;
                    },
                    whitespace: (codePoint) => {
                        this.pushWhitespaceCodePoint(codePoint);
                    },
                    comma: () => {
                        this.pushToken(new CommaToken());
                    },
                    colon: () => {
                        this.pushToken(new ColonToken());
                    },
                    end: () => {
                        resolve(this.root);
                    },
                    openSingleLineComment: () => {
                        // XXX always wrap comments in whitespaces so that it's
                        // ignored
                        this.pushWhitespaceToken(new SingleLineCommentToken(), false);
                    },
                    openMultiLineComment: () => {
                        // XXX always wrap comments in whitespaces so that it's
                        // ignored
                        this.pushWhitespaceToken(new MultiLineCommentToken(), false);
                    },
                    multiLineCommentAsterisk: () => {
                        if (mlAsterisk) {
                            this.pushCodePoint(_asterisk_);
                        }

                        mlAsterisk = true;
                    },
                    closeSingleLineComment: () => {
                        this.popStack();
                        this.popStack();
                    },
                    closeMultiLineComment: () => {
                        mlAsterisk = false;
                        this.popStack();
                        this.popStack();
                    },
                }));

                const readStream = createReadStream(path);

                readStream.on('readable', () => {
                    let chunk;
                    while (null !== (chunk = readStream.read())) {
                        parser.bytes(chunk);
                    }
                });

                readStream.on('end', () => {
                    parser.end();
                });

                readStream.on('error', (err) => {
                    parser.end();
                    reject(err);
                });
            } catch(err) {
                reject(err);
            }
        });
    }

    async writeToFile(path) {
        if (this.root === null) {
            throw new Error('No root token in AST');
        }

        const streamWriter = new StreamWriter(path);
        await this.root.write(streamWriter);
        await streamWriter.close();
    }
}