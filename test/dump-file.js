#!/usr/bin/env node
import { JSONAST } from '../dist/index.js';
(await (new JSONAST()).parse(process.argv[2])).dump();