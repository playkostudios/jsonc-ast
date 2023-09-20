import { Utf8c2bs } from 'utf8x2x';
import { createWriteStream, type WriteStream } from 'node:fs';

export class StreamWriter {
    private stream: WriteStream | null = null;
    private queuedChunks: Uint8Array[] = [];
    private err: unknown;

    constructor(path: string) {
        const stream = createWriteStream(path, { encoding: 'utf8' });
        stream.on('error', (err) => {
            this.stream = null;
            this.err = err;
            stream.close();
        });
        this.stream = stream;

        this.c2b = Utf8c2bs({
            bytes: (byteArray: Iterable<number>) => {
                this.queuedChunks.push(new Uint8Array(byteArray));
            }
        }).codePoint;
    }

    writeChunk(chunk: Uint8Array) {
        if (this.stream) {
            this.stream.write(chunk);
        } else {
            throw new Error('Stream unavailable');
        }
    }

    async flushChunks() {
        for (const chunk of this.queuedChunks) {
            this.writeChunk(chunk);
        }

        this.queuedChunks.length = 0;
    }

    queueCodePoint(codePoint: number) {
        this.c2b(codePoint);
    }

    async writeCodePoint(codePoint: number) {
        this.queueCodePoint(codePoint);
        await this.flushChunks();
    }

    async writeCodePoints(codePoints: Iterable<number>) {
        for (const codePoint of codePoints) {
            this.c2b(codePoint);
        }
        await this.flushChunks();
    }

    async writeString(str: string) {
        for (const codePointStr of str) {
            this.queueCodePoint(codePointStr.codePointAt(0)!);
        }
        await this.flushChunks();
    }

    close() {
        const stream = this.stream;
        this.stream = null;

        return new Promise<void>((resolve, reject) => {
            if (stream) {
                stream.close((err) => {
                    if (err === null || err === undefined) {
                        resolve();
                    } else {
                        reject(err);
                    }
                });
            } else {
                reject(this.err);
            }
        })
    }
}