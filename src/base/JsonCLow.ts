import { JsonLow, CodePoint, unexpected, unexpectedEnd, JsonLowHandler, JsonLowHandlers, JsonLowInitialState, JsonLowState } from '@xtao-org/jsonhilo';

export const _asterisk_ = '*'.codePointAt(0)!;

enum JsonCLowModeOverride {
    /** First character of comment delimiter found (/) */
    _comment = 'Mode.jsonc:_comment',
    /** Multi line comment */
    commentMulti_ = 'Mode.jsonc:commentMulti_',
    /** Maybe end of multi line comment (*) */
    commentMultiMaybeEnd_ = 'Mode.jsonc:commentMultiMaybeEnd_',
    /** Single line comment */
    commentSingle_ = 'Mode.jsonc:commentSingle_',
};

export type JsonCLowHandlers<Feedback, End> = JsonLowHandlers<Feedback, End> & {
  firstCommentSlash?: JsonLowHandler<Feedback>,
  openSingleLineComment?: JsonLowHandler<Feedback>,
  // XXX single line comment might not have code point if at end of json (EOF
  //     instead of newline)
  closeSingleLineComment?: (codePoint?: number) => Feedback,
  openMultiLineComment?: JsonLowHandler<Feedback>,
  closeMultiLineComment?: JsonLowHandler<Feedback>,
  multiLineCommentAsterisk?: JsonLowHandler<Feedback>,
};

export function JsonCLow<Feedback, End>(next: JsonCLowHandlers<Feedback, End>, initialState?: JsonLowInitialState): {
  codePoint(codePoint: number): Feedback,
  end(): End,
  state(): JsonLowState,
} {
    let selfOrig = JsonLow<Feedback, End>(next, initialState);
    let modeOverride: JsonCLowModeOverride | null = null;

    switch(initialState?.mode) {
    case JsonCLowModeOverride._comment:
    case JsonCLowModeOverride.commentMulti_:
    case JsonCLowModeOverride.commentMultiMaybeEnd_:
    case JsonCLowModeOverride.commentSingle_:
        modeOverride = initialState?.mode;
    }

    const self = {
        codePoint: (code: number): Feedback => {
            switch(modeOverride) {
                case null: {
                    if (code === CodePoint._slash_) {
                        const state = selfOrig.state();
                        switch (state.mode) {
                            case 'Mode.zero_':
                            case 'Mode.onenine_':
                            case 'Mode.onenineDigit_':
                            case 'Mode.digitDotDigit_':
                            case 'Mode.exponentSignDigit_': {
                                // finish number
                                // XXX no way to set the mode or call the
                                // `number()` method from JsonLow, so we have to
                                // emulate the mode switch by creating a new
                                // JsonLow instance with the new state as the
                                // initial state
                                const parents = state.parents;
                                selfOrig = JsonLow(next, {
                                    mode: parents[parents.length - 1] === 'Parent.top' ? 'Mode._value' : 'Mode.value_',
                                    parents,
                                    isKey: state.isKey,
                                    maxDepth: state.maxDepth,
                                    hexIndex: state.hexIndex,
                                });
                                next.closeNumber?.();
                            }   // falls through
                            case 'Mode._value':
                            case 'Mode.value_':
                            case 'Mode._key':
                            case 'Mode.key_':
                                // start comment
                                modeOverride = JsonCLowModeOverride._comment;
                                return next.firstCommentSlash?.(code) as Feedback;
                        }
                    }

                    return selfOrig.codePoint(code);
                }
                case JsonCLowModeOverride._comment: {
                    if (code === CodePoint._slash_) {
                        modeOverride = JsonCLowModeOverride.commentSingle_;
                        return next.openSingleLineComment?.(code) as Feedback;
                    } else if (code === _asterisk_) {
                        modeOverride = JsonCLowModeOverride.commentMulti_;
                        return next.openMultiLineComment?.(code) as Feedback;
                    } else {
                        modeOverride = null;
                        return unexpected(code, 'after first comment slash', ['*', '/']) as Feedback;
                    }
                }
                case JsonCLowModeOverride.commentMultiMaybeEnd_: {
                    if (code === CodePoint._slash_) {
                        modeOverride = null;
                        return next.closeMultiLineComment?.(code) as Feedback;
                    } else {
                        modeOverride = JsonCLowModeOverride.commentMulti_;
                    }
                }   // falls through
                case JsonCLowModeOverride.commentMulti_: {
                    if (code === _asterisk_) {
                        modeOverride = JsonCLowModeOverride.commentMultiMaybeEnd_;
                        return next.multiLineCommentAsterisk?.(code) as Feedback;
                    } else {
                        return next.codePoint?.(code) as Feedback;
                    }
                }
                case JsonCLowModeOverride.commentSingle_: {
                    if (code === CodePoint._newline_) {
                        modeOverride = null;
                        next.closeSingleLineComment?.(code);
                        return self.codePoint(code);
                    } else {
                        return next.codePoint?.(code) as Feedback;
                    }
                }
            }
        },
        end: () => {
            if (modeOverride === JsonCLowModeOverride.commentSingle_) {
                next.closeSingleLineComment?.();
                modeOverride = null;
            }

            if (modeOverride !== null) {
                return unexpectedEnd('incomplete comment!') as End;
            }

            return selfOrig.end();
        },
        state: () => {
            const parentState = selfOrig.state();
            if (modeOverride !== null) {
                return { ...parentState, mode: modeOverride };
            } else {
                return parentState;
            }
        },
    };

    return self;
};