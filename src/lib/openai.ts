// OpenAI client factory. Server-only — never import from a client component.
// The API key is read from OPENAI_API_KEY (set in .env.local locally and in
// Vercel project env vars in production).

import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

// Default model — override with OPENAI_MODEL env var if you want to swap.
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
