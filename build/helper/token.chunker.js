"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TOKENS_PER_CHUNK = exports.estimateTokens = exports.chunkTextByTokens = void 0;
// utils/tokenChunker.ts
const tiktoken_1 = require("tiktoken");
const encoder = (0, tiktoken_1.encoding_for_model)("gpt-4.1");
const textDecoder = new TextDecoder("utf-8");
const chunkTextByTokens = (input) => {
    const tokens = encoder.encode(input.text);
    const chunks = [];
    let start = 0;
    while (start < tokens.length) {
        const end = Math.min(start + input.maxTokens, tokens.length);
        const chunkTokens = tokens.slice(start, end);
        // 🔑 decode → Uint8Array → string
        const decodedBytes = encoder.decode(chunkTokens);
        const chunkText = textDecoder.decode(decodedBytes);
        chunks.push(chunkText);
        start = end;
    }
    return chunks;
};
exports.chunkTextByTokens = chunkTextByTokens;
const estimateTokens = (text) => {
    return encoder.encode(text).length;
};
exports.estimateTokens = estimateTokens;
exports.MAX_TOKENS_PER_CHUNK = 10000;
//# sourceMappingURL=token.chunker.js.map