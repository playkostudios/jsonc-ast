import { type JSONTokenType } from './JSONTokenType.js';
import { JSONTokenTypeNames } from './JSONTokenTypeNames.js';
import { type StreamWriter } from '../util/StreamWriter.js';

export abstract class JSONToken<T extends JSONTokenType = JSONTokenType> {
    abstract readonly children: JSONToken[] | null;
    abstract readonly isValue: boolean;

    constructor(readonly type: T) {}

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