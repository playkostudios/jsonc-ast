import { type StreamWriter } from '../util/StreamWriter.js';
import { JSONParentToken } from '../base/JSONParentToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { assertTokenType } from '../util/assertTokenType.js';
import { valueToToken } from '../util/valueToToken.js';
import { ColonToken } from './ColonToken.js';
import { CommaToken } from './CommaToken.js';
import { KeyToken } from './KeyToken.js';
import { WhitespacesToken } from './WhitespacesToken.js';

export class ObjectToken extends JSONParentToken<JSONTokenType.Object> implements JSONValueToken {
    constructor() {
        super(JSONTokenType.Object);
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): ObjectToken {
        return assertTokenType(token, JSONTokenType.Object);
    }

    static fromObject(obj: Record<string, unknown>) {
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
                valueToToken(obj[key]),
            );
        }

        return token;
    }

    evaluate() {
        const obj: Record<string, unknown> = {};
        let expectedToken: JSONTokenType | null = JSONTokenType.Key;
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
                key = (child as KeyToken).getString();
                expectedToken = JSONTokenType.Colon;
            } else if (type === JSONTokenType.Colon) {
                expectedToken = null;
            } else if (expectedToken === null) {
                if (!child.isValue) {
                    throw new Error('Non-value token as value in object');
                }

                const value = (child as JSONValueToken).evaluate();
                expectedToken = JSONTokenType.Comma;
                obj[key!] = value;
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

    maybeGetValueTokenOfKeyOrHasKeys(key: string): JSONValueToken | boolean {
        let expectedToken: JSONTokenType | null = JSONTokenType.Key;
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

                if (key === (child as KeyToken).getString()) {
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
                    return child as JSONValueToken;
                }

                expectedToken = JSONTokenType.Comma;
            } else if (expectedToken === JSONTokenType.Comma) {
                expectedToken = JSONTokenType.Key;
            }
        }

        return hadKeys;
    }

    maybeGetValueTokenOfKey(key: string) {
        const token = this.maybeGetValueTokenOfKeyOrHasKeys(key);
        if (token === true || token === false) {
            return null;
        } else {
            return token;
        }
    }

    getValueTokenOfKey(key: string) {
        const token = this.maybeGetValueTokenOfKey(key);
        if (token === null) {
            throw new Error(`Object has no key "${key}"`);
        } else {
            return token;
        }
    }

    maybeGetValueOfKey(key: string) {
        const token = this.maybeGetValueTokenOfKey(key);
        if (token) {
            return token.evaluate();
        } else {
            return;
        }
    }

    getValueOfKey(key: string) {
        return this.getValueTokenOfKey(key).evaluate();
    }

    setValueOfKey(key: string, value: unknown, indent = 0) {
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
                valueToToken(value),
            );

            return true;
        } else {
            const curValue = token.evaluate();
            if (curValue !== value) {
                this.replaceChild(token, valueToToken(value));
                return true;
            }
        }

        return false;
    }

    getTokenEntries() {
        const entries: Array<[key: string, value: JSONValueToken]> = [];
        let expectedToken: JSONTokenType | null = JSONTokenType.Key;
        let key: string | null = null;

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
                key = (child as KeyToken).getString();
                expectedToken = JSONTokenType.Colon;
            } else if (type === JSONTokenType.Colon) {
                expectedToken = null;
            } else if (expectedToken === null) {
                if (!child.isValue) {
                    throw new Error('Non-value token as value in object');
                }

                entries.push([key!, child as JSONValueToken]);
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

    deleteKey(key: string): boolean {
        let expectedToken: JSONTokenType | null = JSONTokenType.Key;
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
                } else if (key === (child as KeyToken).getString()) {
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

    guessKeyIndent() {
        let keyIndent = 0;
        const childCount = this.children.length;

        for (let c = 1; c < childCount; c++) {
            const child = this.children[c];
            if (child.type === JSONTokenType.Key) {
                const prevChild = this.children[c - 1];
                if (prevChild.type === JSONTokenType.Whitespaces) {
                    keyIndent = (prevChild as WhitespacesToken).guessIndent();
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

    getEndIdx() {
        for (let c = this.children.length - 1; c >= 0; c--) {
            const child = this.children[c];
            if (child.type !== JSONTokenType.Whitespaces) {
                return c + 1;
            }
        }

        return 0;
    }

    async write(streamWriter: StreamWriter) {
        await streamWriter.writeString('{');
        await super.write(streamWriter);
        await streamWriter.writeString('}');
    }
}