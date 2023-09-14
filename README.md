# jsonc-ast

Experimental lossless JSONC AST parser and encoder. Uses `jsonhilo` to tokenize
JSON, and then converts the tokens to easier-to-use objects. A JSONC tokenizer
is also provided to allow for optional JSONC support.

Note that this loses the benefits of using a streaming parser; the entire JSON
document is stored in memory. Using `jsonhilo` may be more appropriate for your
use-case.

# Building

```
pnpm run build
```

# Usage

TODO