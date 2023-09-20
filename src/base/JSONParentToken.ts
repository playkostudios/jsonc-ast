import { JSONToken } from './JSONToken.js';
import { type JSONTokenType } from './JSONTokenType.js';

export abstract class JSONParentToken<T extends JSONTokenType = JSONTokenType> extends JSONToken<T> {
    override readonly children: JSONToken[] = [];

    replaceChild(oldChild: JSONToken, newChild: JSONToken) {
        const idx = this.children.indexOf(oldChild);
        if (idx < 0) {
            throw new Error('Child token not found');
        }

        this.children.splice(idx, 1, newChild);
    }
}