import { createReadStream } from 'node:fs';
import { JsonLow } from '@xtao-org/jsonhilo';
import { Utf8bs2c } from 'utf8x2x';
import { JsonCLow, _asterisk_ } from './JsonCLow.js';
import { ArrayToken } from '../tokens/ArrayToken.js';
import { CodePointsToken } from '../tokens/CodePointsToken.js';
import { ColonToken } from '../tokens/ColonToken.js';
import { CommaToken } from '../tokens/CommaToken.js';
import { EscapeToken } from '../tokens/EscapeToken.js';
import { FalseToken } from '../tokens/FalseToken.js';
import { HexToken } from '../tokens/HexToken.js';
import { KeyToken } from '../tokens/KeyToken.js';
import { MultiLineCommentToken } from '../tokens/MultiLineCommentToken.js';
import { NullToken } from '../tokens/NullToken.js';
import { NumberToken } from '../tokens/NumberToken.js';
import { ObjectToken } from '../tokens/ObjectToken.js';
import { RootToken } from '../tokens/RootToken.js';
import { SingleLineCommentToken } from '../tokens/SingleLineCommentToken.js';
import { StringToken } from '../tokens/StringToken.js';
import { TrueToken } from '../tokens/TrueToken.js';
import { WhitespacesToken } from '../tokens/WhitespacesToken.js';
import { JSONToken } from './JSONToken.js';
import { StreamWriter } from '../util/StreamWriter.js';
import { type JSONParentToken } from './JSONParentToken.js';
import { JSONTokenType } from './JSONTokenType.js';

export class JSONAST {
    root: RootToken | null = null;
    stack = new Array<JSONParentToken>();

    constructor() {
        this.stack = [];
    }

    static async parseValue(path: string, allowComments: boolean) {
        const ast = new JSONAST();
        const root = await ast.parse(path, allowComments);
        return root.getValue();
    }

    get focus() {
        return this.stack[this.stack.length - 1];
    }

    pushToken(token: JSONToken) {
        const stackLen = this.stack.length;
        if (stackLen === 0) {
            if (this.root) {
                throw new Error('Nothing in stack, but root is set; possible bug');
            } else {
                this.root = RootToken.assert(token);
            }
        } else {
            this.stack[stackLen - 1].children.push(token);
        }

        if (token.children) {
            this.stack.push(token as JSONParentToken);
        }
    }

    pushCodePointTo(codePoint: number, parentToken: JSONParentToken) {
        const children = parentToken.children;
        const childCount = children.length;
        const lastChild = childCount === 0 ? null : children[childCount - 1];

        if (lastChild !== null && lastChild.type === JSONTokenType.CodePoints) {
            (lastChild as CodePointsToken).codePoints.push(codePoint);
        } else {
            children.push(CodePointsToken.fromCodePoint(codePoint));
        }
    }

    pushCodePoint(codePoint: number) {
        if (!this.root) {
            throw new Error('No root token');
        }

        const stackLen = this.stack.length;
        if (stackLen === 0) {
            throw new Error('Nothing in stack, but root is set; possible bug');
        }

        this.pushCodePointTo(codePoint, this.stack[stackLen - 1]);
    }

    pushWhitespaceCodePoint(codePoint: number) {
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
            this.pushCodePointTo(codePoint, lastChild as WhitespacesToken);
        } else {
            this.pushToken(new WhitespacesToken());
            this.pushToken(CodePointsToken.fromCodePoint(codePoint));
            this.popStack();
        }
    }

    pushWhitespaceToken(token: JSONToken, pop = true) {
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
            const lastWSChild = lastChild as WhitespacesToken;
            lastWSChild.children.push(token);
            if (!pop && token.children) {
                this.stack.push(lastWSChild, token as JSONParentToken);
            }
        } else {
            this.pushToken(new WhitespacesToken());
            this.pushToken(token);
            if (pop) {
                if (token.children) {
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

    parse(path: string, allowComments = false): Promise<RootToken> {
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
                    openNumber: (codePoint: number) => {
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
                    codePoint: (codePoint: number) => {
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
                    whitespace: (codePoint: number) => {
                        this.pushWhitespaceCodePoint(codePoint);
                    },
                    comma: () => {
                        this.pushToken(new CommaToken());
                    },
                    colon: () => {
                        this.pushToken(new ColonToken());
                    },
                    end: () => {
                        if (this.root) {
                            resolve(this.root);
                        } else {
                            reject(new Error('Parsing ended but no root token created'));
                        }
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

    async writeToFile(path: string) {
        if (this.root === null) {
            throw new Error('No root token in AST');
        }

        const streamWriter = new StreamWriter(path);
        await this.root.write(streamWriter);
        await streamWriter.close();
    }
}