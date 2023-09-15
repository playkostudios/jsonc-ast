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