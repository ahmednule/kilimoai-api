/**
 * Minimal client for Featherless AI's OpenAI-compatible chat completions API
 * (https://featherless.ai). Featherless hosts open-source, multilingual models
 * (e.g. Cohere Aya) which we use for Swahili/English explanations — see
 * docs/PRD.md §11.
 *
 * Deliberately dependency-free: it uses the global `fetch`. Callers are
 * expected to handle failures (the ExplanationService falls back to a
 * deterministic template), so this throws rather than swallowing errors.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FeatherlessConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

/** Reads Featherless config from the environment, or returns null if unset. */
export function featherlessConfigFromEnv(): FeatherlessConfig | null {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.FEATHERLESS_MODEL || 'CohereForAI/aya-expanse-8b',
    baseUrl: process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1',
  };
}

export class FeatherlessClient {
  constructor(private config: FeatherlessConfig) {}

  get model(): string {
    return this.config.model;
  }

  /**
   * Sends a chat completion request and returns the assistant's text.
   * @throws if the request fails, times out, or returns no content.
   */
  async chat(
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
  ): Promise<string> {
    const { temperature = 0.3, maxTokens = 400, timeoutMs = 15000 } = opts;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Featherless request failed (${res.status}): ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Featherless returned an empty completion');
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}
