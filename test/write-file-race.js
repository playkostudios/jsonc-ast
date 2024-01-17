#!/usr/bin/env node
import { JSONAST, ObjectToken, RootToken } from '../dist/index.js';
import { mkdtemp } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ast = new JSONAST();
ast.pushToken(new RootToken());
ast.pushToken(ObjectToken.fromObject({ test: 123 }));
const tempOutPath = join(await mkdtemp(join(tmpdir(), 'jsonc-ast-test-')), 'out.json');
await ast.writeToFile(tempOutPath);
console.debug(readFileSync(tempOutPath, { encoding: 'utf8' }));