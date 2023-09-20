import { type JSONToken } from './JSONToken.js';

export interface JSONValueToken extends JSONToken {
    evaluate(): unknown;
    isValue: true;
}