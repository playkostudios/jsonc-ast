import { closeSync, createReadStream, openSync, readSync } from 'node:fs';
import { isError, JsonErrorType, type JsonStandardFeedback, type JsonUnexpectedFeedback } from '@xtao-org/jsonhilo';
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

const SYNC_READ_CHUNK_SIZE = 4096;

export class JSONAST {
    root: RootToken | null = null;
    stack = new Array<JSONParentToken>();

    constructor() {
        this.stack = [];
    }

    static async parseValue(path: string, allowComments: boolean | undefined, allowTrailingCommas: boolean | undefined) {
        const ast = new JSONAST();
        const root = await ast.parse(path, allowComments);
        return root.getValue(allowTrailingCommas);
    }

    static parseValueSync(path: string, allowComments: boolean | undefined, allowTrailingCommas: boolean | undefined) {
        const ast = new JSONAST();
        const root = ast.parseSync(path, allowComments);
        return root.getValue(allowTrailingCommas);
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

    private createParseContext(allowComments: boolean, resolve: (rootToken: RootToken) => void, reject: (error: unknown) => void) {
        let escapeNext = false;
        let escapeHex = false;
        let ignoreCodePoints = false;
        let mlAsterisk = false;

        const bareParser = JsonCLow(allowComments)({
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
        });

        return Utf8bs2c({
            codePoint: (byte: number) => {
                const ret = bareParser.codePoint(byte);
                if (isError(ret)) {
                    const feedback = ret as JsonStandardFeedback;
                    if ('message' in feedback) {
                        reject(new Error(`Invalid JSON file; ${feedback.message}`));
                    } else if (feedback.errorType === JsonErrorType.unexpected) {
                        const unexpectedFeedback = feedback as JsonUnexpectedFeedback;
                        if (!unexpectedFeedback.expected) {
                            reject(new Error(`Invalid JSON file; unexpected '${String.fromCodePoint(feedback.codePoint)}' ${feedback.context}`));
                        } else {
                            const expectedParts: string[] = [];
                            for (const candidate of unexpectedFeedback.expected) {
                                if (Array.isArray(candidate)) {
                                    expectedParts.push(`'${candidate[0]}'-'${candidate[1]}'`);
                                } else if (candidate.length === 1) {
                                    expectedParts.push(`'${candidate}'`);
                                } else {
                                    expectedParts.push(candidate);
                                }
                            }

                            const expectedPartCount = expectedParts.length;
                            if (expectedPartCount > 1) {
                                expectedParts[expectedPartCount - 1] = `${expectedParts[expectedPartCount - 2]} or ${expectedParts.pop()}`;
                            }

                            reject(new Error(`Invalid JSON file; expected ${expectedParts.join(', ')} ${feedback.context}, but found '${String.fromCodePoint(feedback.codePoint)}' instead`));
                        }
                    } else {
                        reject(new Error('Invalid JSON file; unknown error'));
                    }
                }
            },
            end: () => bareParser.end(),
        });
    }

    parse(path: string, allowComments = false): Promise<RootToken> {
        this.pushToken(new RootToken());

        return new Promise((resolve, reject) => {
            try {
                // open file for reading
                const parser = this.createParseContext(allowComments, resolve, (err) => {
                    reject(err);
                    readStream.close();
                });
                const readStream = createReadStream(path);

                readStream.on('end', () => {
                    if (isError(parser.end())) {
                        reject(new Error('Invalid JSON file; end unexpectedly reached'));
                    }
                });

                readStream.once('error', (err) => {
                    reject(err);
                    parser.end();
                });

                readStream.on('data', (chunk: Buffer | string) => {
                    parser.bytes(chunk as Buffer); // HACK assume chunks are never strings
                });
            } catch(err) {
                reject(err);
            }
        });
    }

    parseSync(path: string, allowComments = false): RootToken {
        this.pushToken(new RootToken());

        // open file for reading
        let rootToken: RootToken | undefined;
        const parser = this.createParseContext(allowComments, (out) => {
            rootToken = out;
        }, (err) => {
            throw err;
        });

        const chunk = Buffer.allocUnsafe(SYNC_READ_CHUNK_SIZE);
        let fd = openSync(path, 'r');
        try {
            let bytesRead: number;
            while ((bytesRead = readSync(fd, chunk, 0, SYNC_READ_CHUNK_SIZE, -1)) > 0) {
                if (bytesRead === SYNC_READ_CHUNK_SIZE) {
                    parser.bytes(chunk);
                } else {
                    parser.bytes(new Uint8Array(chunk.buffer, 0, bytesRead));
                }
            }

            parser.end();
        } finally {
            closeSync(fd);
        }

        if (rootToken === undefined) {
            throw new Error('rootToken is undefined. Please report this to the jsonc-ast library developer');
        }

        return rootToken;
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