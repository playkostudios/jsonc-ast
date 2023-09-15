import { type JSONTokenType } from './JSONTokenType.js';
import { JSONTokenTypeNames } from './JSONTokenTypeNames.js';
import { type StreamWriter } from '../StreamWriter.js';

export abstract class JSONToken {
    abstract readonly children: JSONToken[] | null;

    constructor(readonly type: JSONTokenType) {}

    get isValue() {
        return false;
    }

    async write(streamWriter: StreamWriter) {
        if (this.children) {
            for (const child of this.children) {
                await child.write(streamWriter);
            }
        }
    }

    dump(depth = 0) {
        const name = JSONTokenTypeNames[this.type];
        const indent = '    '.repeat(depth);

        if (this.children && this.children.length > 0) {
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