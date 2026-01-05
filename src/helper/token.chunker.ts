// utils/tokenChunker.ts
import { encoding_for_model } from "tiktoken";

const encoder = encoding_for_model("gpt-4.1");
const textDecoder = new TextDecoder("utf-8");

export const chunkTextByTokens = (input: {
  text: string;
  maxTokens: number;
}): string[] => {
  const tokens = encoder.encode(input.text);
  const chunks: string[] = [];

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



export const MAX_TOKENS_PER_CHUNK = 10000;
