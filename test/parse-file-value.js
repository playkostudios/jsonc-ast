#!/usr/bin/env node
import { JSONAST } from '../dist/index.js';
console.log(await JSONAST.parseValue(process.argv[2], false, true));