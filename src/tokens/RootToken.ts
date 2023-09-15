export class RootToken extends JSONToken {
    constructor() {
        super(JSONTokenType.Root, true);
    }

    /**
     * @param {JSONToken} token
     * @returns {RootToken}
     */
    static assert(token) {
        return /** @type {RootToken} */ (assertTokenType(token, JSONTokenType.Root));
    }

    /** @returns {JSONValueToken} */
    getValueToken() {
        let token = null;
        for (const child of this.children) {
            if (child.isValue) {
                if (token) {
                    throw new Error('Multiple value tokens in root');
                }

                token = child;
            } else if (child.type !== JSONTokenType.Whitespaces) {
                throw new Error('Unexpected non-whitespace token in root');
            }
        }

        if (token === null) {
            throw new Error('No value token in root');
        }

        return token;
    }

    getValue() {
        return this.getValueToken().evaluate();
    }
}