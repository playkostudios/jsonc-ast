#!/usr/bin/env node
import { JSONAST } from '../dist/index.js';
console.log(JSONAST.parseValueSync(process.argv[2], false, true));