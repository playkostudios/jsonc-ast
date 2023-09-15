function evalStringLikeToken(tokenName, token) {
    const parts = [];
    for (const child of token.children) {
        if (child.type === JSONTokenType.CodePoints || child.type === JSONTokenType.Escape) {
            parts.push(child.evaluate());
        } else {
            throw new Error(`Unexpected token in ${tokenName}`);
        }
    }

    return parts.join('');
}