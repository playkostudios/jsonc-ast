import { JsonLow, unexpected, unexpectedEnd } from '@xtao-org/jsonhilo';

const _newline_ = '\n'.codePointAt(0);
const _slash_ = '/'.codePointAt(0);
export const _asterisk_ = '*'.codePointAt(0);

export const JsonCLow = (next, initialState = {}) => {
    let selfOrig = JsonLow(next, initialState);

    // Mode._comment - first character of comment delimiter found (/)
    // Mode.commentMulti_ - multi line comment
    // Mode.commentMultiMaybeEnd_ - maybe end of multi line comment (*)
    // Mode.commentSingle_ - single line comment
    let modeOverride = null;

    // XXX need to track hexIndex separately because the JsonLow api doesn't
    // provide it
    let hexIndex = 0;

    const self = {
        codePoint: (code) => {
            switch(modeOverride) {
                case null: {
                    const state = selfOrig.state();
                    const mode = state.mode;
                    if (mode === 'Mode.hex_') {
                        if (hexIndex < 3) {
                            hexIndex++;
                        } else {
                            hexIndex = 0;
                        }
                    }

                    if (code === _slash_) {
                        switch (mode) {
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
                                    parents, isKey: state.isKey,
                                    maxDepth: initialState.maxDepth, hexIndex,
                                });
                                next.closeNumber?.();
                            }   // falls through
                            case 'Mode._value':
                            case 'Mode.value_':
                            case 'Mode._key':
                            case 'Mode.key_':
                                // start comment
                                modeOverride = 'Mode._comment';
                                return next.firstCommentSlash?.();
                        }
                    }

                    return selfOrig.codePoint(code);
                }
                case 'Mode._comment': {
                    if (code === _slash_) {
                        modeOverride = 'Mode.commentSingle_';
                        return next.openSingleLineComment?.();
                    } else if (code === _asterisk_) {
                        modeOverride = 'Mode.commentMulti_';
                        return next.openMultiLineComment?.();
                    } else {
                        modeOverride = null;
                        return unexpected(code, 'after first comment slash', ['*', '/']);
                    }
                }
                case 'Mode.commentMultiMaybeEnd_': {
                    if (code === _slash_) {
                        modeOverride = null;
                        return next.closeMultiLineComment?.();
                    } else {
                        modeOverride = 'Mode.commentMulti_';
                    }
                }   // falls through
                case 'Mode.commentMulti_': {
                    if (code === _asterisk_) {
                        modeOverride = 'Mode.commentMultiMaybeEnd_';
                        return next.multiLineCommentAsterisk?.();
                    } else {
                        return next.codePoint?.(code);
                    }
                }
                case 'Mode.commentSingle_': {
                    if (code === _newline_) {
                        modeOverride = null;
                        next.closeSingleLineComment?.();
                        return self.codePoint(code);
                    } else {
                        return next.codePoint?.(code);
                    }
                }
            }
        },
        end: () => {
            if (modeOverride === 'Mode.commentSingle_') {
                next.closeSingleLineComment?.();
                modeOverride = null;
            }

            if (modeOverride !== null) {
                return unexpectedEnd('incomplete comment!');
            }

            return selfOrig.end();
        },
        state: () => {
            const parentState = selfOrig.state();
            if (modeOverride !== null) {
                return { mode: modeOverride, parents: parentState.parents, isKey: parentState.isKey, downstream: parentState.downstream };
            } else {
                return parentState;
            }
        },
    };

    return self;
};