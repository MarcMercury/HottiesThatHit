// Provider-agnostic LLM router for /api/ask.
//
// Selects a chat provider based on env at call time, in this priority:
//   1. LLM_PROVIDER explicit choice  ("openai" | "gemini" | "groq")
//   2. OPENAI_API_KEY  — uses OPENAI_MODEL (default gpt-4o-mini)
//   3. GROQ_API_KEY    — uses GROQ_MODEL   (default llama-3.3-70b-versatile)
//   4. GEMINI_API_KEY  — uses GEMINI_MODEL (default gemini-2.0-flash)
//
// All three providers are called via OpenAI-compatible chat-completions APIs
// so we don't need extra SDK dependencies.

import OpenAI from 'openai';

export type Provider = 'openai' | 'gemini' | 'groq';

interface ProviderConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  baseURL?: string;
}

function pickProvider(): ProviderConfig {
  const explicit = process.env.LLM_PROVIDER as Provider | undefined;
  const order: Provider[] = explicit
    ? [explicit]
    : ['openai', 'groq', 'gemini'];

  for (const p of order) {
    if (p === 'openai' && process.env.OPENAI_API_KEY) {
      return {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      };
    }
    if (p === 'groq' && process.env.GROQ_API_KEY) {
      return {
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        baseURL: 'https://api.groq.com/openai/v1',
      };
    }
    if (p === 'gemini' && process.env.GEMINI_API_KEY) {
      return {
        provider: 'gemini',
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      };
    }
  }

  throw new Error(
    'No LLM provider configured. Set OPENAI_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY.'
  );
}

let _client: { client: OpenAI; cfg: ProviderConfig } | null = null;

export function getLLM(): { client: OpenAI; model: string; provider: Provider } {
  if (!_client) {
    const cfg = pickProvider();
    _client = {
      client: new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL }),
      cfg,
    };
  }
  return {
    client: _client.client,
    model: _client.cfg.model,
    provider: _client.cfg.provider,
  };
}
