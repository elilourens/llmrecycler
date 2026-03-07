// Model to provider mapping
const EXACT_MATCHES: Record<string, string> = {
  // Add specific model mappings here
};

const PREFIX_PATTERNS: Array<{ prefix: string; provider: string }> = [
  { prefix: "claude-", provider: "Anthropic" },
  { prefix: "gpt-", provider: "OpenAI" },
  { prefix: "gemini-", provider: "Google" },
  { prefix: "deepseek-", provider: "DeepSeek" },
];

export function detectProvider(model: string): string | null {
  const normalizedModel = model.toLowerCase();

  // Try exact match first
  if (EXACT_MATCHES[normalizedModel]) {
    return EXACT_MATCHES[normalizedModel];
  }

  // Try prefix matching
  for (const pattern of PREFIX_PATTERNS) {
    if (normalizedModel.startsWith(pattern.prefix)) {
      return pattern.provider;
    }
  }

  return null;
}

export function isValidProvider(provider: string): boolean {
  const validProviders = ["Anthropic", "OpenAI", "Google", "DeepSeek"];
  return validProviders.includes(provider);
}
