import { JSONToken } from './JSONToken.js';

export abstract class JSONParentToken extends JSONToken {
    override readonly children: JSONToken[] = [];

    replaceChild(oldChild: JSONToken, newChild: JSONToken) {
        const idx = this.children.indexOf(oldChild);
        if (idx < 0) {
            throw new Error('Child token not found');
        }

        this.children.splice(idx, 1, newChild);
    }
}