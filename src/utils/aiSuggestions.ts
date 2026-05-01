/**
 * AI suggestion streaming utility.
 * Reuses the same /api/claude proxy as voice fill but streams plain text
 * rather than JSON — used for pre-brew intent, pattern insight, etc.
 */

export const HAIKU_MODEL  = 'claude-haiku-4-5-20251001';
export const SONNET_MODEL = 'claude-sonnet-4-5-20251029';

export type SuggestionModel = typeof HAIKU_MODEL | typeof SONNET_MODEL;

/**
 * Streams a suggestion from Claude.
 * onChunk is called with each text delta as it arrives.
 * Returns the full accumulated text when complete.
 */
export async function streamSuggestion(
  prompt: string,
  model: SuggestionModel,
  onChunk: (delta: string) => void,
  apiKey?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 900,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error?.message || `API error ${response.status}`);
  }

  // Fallback: non-streaming response
  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('event-stream') || !response.body) {
    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? '';
    onChunk(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      let event: any;
      try { event = JSON.parse(payload); } catch { continue; }
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        accumulated += event.delta.text;
        onChunk(event.delta.text);
      }
    }
  }

  return accumulated;
}

/**
 * Build the pre-brew intent prompt from coffee + intent + personal brew history.
 */
export function buildPreBrewPrompt(
  coffee: {
    roaster: string;
    coffeeName?: string;
    countryOrigin: string;
    region?: string;
    processingMethod: string;
    roastLevel: string;
    varietal?: string;
    elevation?: string;
    tastingNotes?: string;
  },
  intent: string,
  brewHistory: Array<{
    brewDate: string;
    brewingDevice: string;
    grindSetting: number;
    coffeeDose: number;
    waterAmount: number;
    waterTempF: number;
    brewScore?: number;
    perceivedExtraction?: string;
    flavorNotes?: string;
    acidity?: number;
    sweetness?: number;
    clarity?: number;
    body?: number;
  }>,
): string {
  const coffeeLine = [
    `Roaster: ${coffee.roaster}`,
    coffee.coffeeName ? `Name: ${coffee.coffeeName}` : null,
    `Origin: ${coffee.countryOrigin}${coffee.region ? `, ${coffee.region}` : ''}`,
    `Processing: ${coffee.processingMethod}`,
    `Roast: ${coffee.roastLevel}`,
    coffee.varietal ? `Varietal: ${coffee.varietal}` : null,
    coffee.elevation ? `Elevation: ${coffee.elevation}` : null,
    coffee.tastingNotes ? `Bag notes: ${coffee.tastingNotes}` : null,
  ].filter(Boolean).join('\n');

  const historySection = brewHistory.length === 0
    ? 'No previous brews logged with this coffee yet.'
    : brewHistory.slice(0, 5).map((b, i) => {
        const ratio = b.waterAmount && b.coffeeDose
          ? `${(b.waterAmount / b.coffeeDose).toFixed(1)}:1`
          : '—';
        const flavor = [
          b.acidity   != null ? `acidity ${b.acidity}/5`   : null,
          b.sweetness != null ? `sweetness ${b.sweetness}/5` : null,
          b.clarity   != null ? `clarity ${b.clarity}/5`   : null,
          b.body      != null ? `body ${b.body}/5`         : null,
        ].filter(Boolean).join(', ');
        return [
          `${i + 1}. ${b.brewDate} — ${b.brewingDevice}, ${b.grindSetting} clicks, ${b.coffeeDose}g/${b.waterAmount}g (${ratio}), ${b.waterTempF}°F`,
          b.brewScore != null ? `   Score: ${b.brewScore}/100` : null,
          b.perceivedExtraction ? `   Extraction: ${b.perceivedExtraction}` : null,
          flavor ? `   Flavor: ${flavor}` : null,
          b.flavorNotes ? `   Notes: ${b.flavorNotes}` : null,
        ].filter(Boolean).join('\n');
      }).join('\n\n');

  return `You are a specialty coffee brewing expert with deep knowledge of extraction science, processing method characteristics, origin flavor tendencies, and sensory evaluation.

COFFEE:
${coffeeLine}

BREWER'S INTENT: "${intent}"

PERSONAL BREW HISTORY WITH THIS COFFEE (${brewHistory.length} brew${brewHistory.length !== 1 ? 's' : ''}):
${historySection}

Provide a specific pour over brewing recommendation. Use exactly this structure:

**From coffee science & expertise:**
Advice grounded in extraction theory, the specific processing method, origin, roast level, and varietal characteristics. Be specific and technical.

**From your brew history:**
${brewHistory.length >= 2
  ? 'Personalized advice based on their logged brews — identify patterns, what improved scores, what to repeat or change.'
  : 'Not enough personal data yet to draw patterns from your logs. The above advice is based on coffee expertise only. Log 2+ brews with this coffee to unlock personalized insights.'}

**Starting point:**
A specific recipe with concrete numbers: device, grind setting (if Timemore Sculptor 078 or Comandante C40), dose, water, temp, bloom, pours, brew time.

Keep each section concise. Total response under 350 words.`;
}
