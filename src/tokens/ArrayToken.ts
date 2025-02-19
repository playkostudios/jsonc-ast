import { assertTokenType } from '../util/assertTokenType.js';
import { JSONParentToken } from '../base/JSONParentToken.js';
import { JSONTokenType } from '../base/JSONTokenType.js';
import { type JSONValueToken } from '../base/JSONValueToken.js';
import { type JSONToken } from '../base/JSONToken.js';
import { CommaToken } from './CommaToken.js';
import { valueToToken } from '../util/valueToToken.js';
import { WhitespacesToken } from './WhitespacesToken.js';
import { type StreamWriter } from '../util/StreamWriter.js';
import { evalCollectionOrOtherToken } from '../util/evalCollectionOrOtherToken.js';

export class ArrayToken extends JSONParentToken<JSONTokenType.Array> implements JSONValueToken {
    constructor() {
        super(JSONTokenType.Array);
    }

    override get isValue(): true {
        return true;
    }

    static assert(token: JSONToken): ArrayToken {
        return assertTokenType(token, JSONTokenType.Array);
    }

    static fromArray(arr: Array<unknown>) {
        const token = new ArrayToken();
        const children = token.children;
        let first = true;

        for (const value of arr) {
            if (first) {
                first = false;
            } else {
                children.push(new CommaToken());
            }

            children.push(valueToToken(value));
        }

        return token;
    }

    getTokenEntries(): Array<JSONValueToken> {
        const arr: Array<JSONValueToken> = [];
        let expectedToken = null;

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
                arr.push(child as JSONValueToken);
            } else if (expectedToken === JSONTokenType.Comma) {
                expectedToken = null;
            }
        }

        return arr;
    }

    guessValueIndent(): number {
        let indent = 0;
        const childCount = this.children.length;

        for (let c = 1; c < childCount; c++) {
            const child = this.children[c];
            if (child.isValue) {
                const prevChild = this.children[c - 1];
                if (prevChild.type === JSONTokenType.Whitespaces) {
                    indent = (prevChild as unknown as WhitespacesToken).guessIndent();
                    break;
                }
            }
        }

        return indent;
    }

    inlineInsert(tkIdx: number, items: Array<JSONValueToken>, off: number, indentation: number | null = null) {
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

    pushArr(items: Array<JSONValueToken>, off: number, indentation: number | null = null) {
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

    push(...items: Array<JSONValueToken>) {
        this.pushArr(items, 0);
    }

    /**
     * @returns An array with all the tokens that were removed
     */
    splice(start: number, deleteCount: number, ...items: Array<JSONValueToken>): Array<JSONValueToken> {
        if (start < 0) {
            throw new Error('Negative start index not supported');
        }

        let insertCount = items.length;
        let insertIdx = 0;
        let expectedToken = null;
        const indentation = this.guessValueIndent();
        const deleted: Array<JSONValueToken> = [];
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

                if (start > 0) {
                    start--;
                } else {
                    // we're at the target!
                    if (deleteCount > 0) {
                        deleteCount--;
                        deleted.push(child as JSONValueToken);

                        if (insertIdx < insertCount) {
                            // replace
                            this.children[t] = items[insertIdx++];
                        } else if (deleteStart === -1) {
                            // start deleting range
                            deleteNextComma = lastCommaIdx === null;
                            deleteStart = deleteNextComma ? t : lastCommaIdx!;
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
            }
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

    evaluate(allowTrailingCommas = false) {
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
                arr.push(evalCollectionOrOtherToken(child as JSONValueToken, allowTrailingCommas));
                needsValue = false;
            } else if (expectedToken === JSONTokenType.Comma) {
                expectedToken = null;
                needsValue = true;
            }
        }

        if (needsValue && !allowTrailingCommas) {
            throw new Error('Trailing comma in array');
        }

        return arr;
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
        await streamWriter.writeString('[');
        await super.write(streamWriter);
        await streamWriter.writeString(']');
    }
}