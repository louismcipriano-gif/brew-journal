/**
 * Claude-powered voice transcript parser for brew logs.
 * Sends the raw transcript to Claude and gets back structured brew fields.
 */

const KNOWN_DEVICES = [
  'V60', 'Orea 01', 'Orea Z1', 'V60 Switch', 'Mugen Switch',
  'Cafec Flower', 'Kalita Wave', 'Origami Cone', 'Origami Flat',
  'Cafec Deep 27', 'Melodrip Column', 'Kono', 'April Brewer',
  'Hario Mugen', 'Hario Cloth', 'Torch Mountain', 'Orea V3',
  'OXO Rapid Brewer', 'Flair 58', 'French Press', 'Mokka Pot',
];
const KNOWN_FILTERS = [
  'Cafec T-90', 'T-92', 'Abaca', 'Deep 27', 'Sibarist Z1',
  'Orea Flat', 'Origami Wave', 'Kalita Wave', 'April Wave', 'Kono', 'Melodrip Column',
];
const KNOWN_GRINDERS = ['Timemore Sculptor 078', 'Comandante C40', 'Niche Zero'];
const GRIND_SIZES = ['Fine Espresso', 'Coarse Espresso', 'Fine / Mokka', 'Medium Fine', 'Medium', 'Medium Coarse', 'Coarse'];

export interface VoiceBrewFields {
  // Setup
  brewMethod?: string;
  brewingDevice?: string;
  grinder?: string;
  grindSetting?: string;
  grindSize?: string;
  filter?: string;
  brewerShape?: 'Cone' | 'Flat';
  bypass?: 'Standard' | 'Low Bypass' | 'No Bypass';
  pourStyle?: 'Circular' | 'Center' | 'Hybrid';
  // Recipe parameters
  coffeeDose?: number;
  waterAmount?: number;
  waterTempF?: number;
  waterPPM?: number;
  brewRecipeName?: string;
  // Flavor profile
  acidity?: number;
  sweetness?: number;
  body?: number;
  florality?: number;
  clarity?: number;
  juiciness?: number;
  finish?: number;
  astringency?: number;
  sourness?: number;
  flavorNotes?: string;
  perceivedExtraction?: 'Under' | 'Balanced' | 'Over';
  suggestedChange?: string;
  moreAcidity?: boolean;
  moreSweetness?: boolean;
  moreClarity?: boolean;
  moreFlorality?: boolean;
  moreBody?: boolean;
  lessBitterness?: boolean;
  lessAstringency?: boolean;
  lessSourness?: boolean;
}

const PROMPT = (transcript: string) => `You are a specialty coffee brew log parser. A barista just described their brew session aloud.

Extract every piece of information into this JSON structure. Only include fields that were clearly mentioned.
For slider values (acidity, sweetness, etc.) map descriptors to a 1–10 scale:
  "none/zero" → 0–1, "low/mild" → 2–3, "medium/moderate" → 4–6, "high/good" → 7–8, "very high/excellent" → 9–10

Known brewing devices (match closely, return exact string): ${JSON.stringify(KNOWN_DEVICES)}
Known filters (match closely, return exact string): ${JSON.stringify(KNOWN_FILTERS)}
Known grinders (match closely, return exact string): ${JSON.stringify(KNOWN_GRINDERS)}
Known grind sizes (return exact string): ${JSON.stringify(GRIND_SIZES)}

Return ONLY valid JSON — no markdown, no explanation:
{
  "brewMethod": "Pour Over" | "Espresso" | "Immersion" | "AeroPress" | "Zuppa Longa",
  "brewingDevice": string from known devices or null,
  "grinder": string from known grinders or null,
  "grindSetting": string,
  "grindSize": string from known grind sizes or null,
  "filter": string from known filters or null,
  "brewerShape": "Cone" | "Flat",
  "bypass": "Standard" | "Low Bypass" | "No Bypass",
  "pourStyle": "Circular" | "Center" | "Hybrid",
  "coffeeDose": number (grams),
  "waterAmount": number (grams),
  "waterTempF": number (convert Celsius → Fahrenheit if needed),
  "waterPPM": number,
  "brewRecipeName": string,
  "acidity": number 1-10,
  "sweetness": number 1-10,
  "body": number 1-10,
  "florality": number 1-10,
  "clarity": number 1-10,
  "juiciness": number 1-10,
  "finish": number 1-10,
  "astringency": number 0-10,
  "sourness": number 0-10,
  "flavorNotes": string,
  "perceivedExtraction": "Under" | "Balanced" | "Over",
  "suggestedChange": string,
  "moreAcidity": boolean,
  "moreSweetness": boolean,
  "moreClarity": boolean,
  "moreFlorality": boolean,
  "moreBody": boolean,
  "lessBitterness": boolean,
  "lessAstringency": boolean,
  "lessSourness": boolean
}

Transcript: "${transcript}"`;

export async function parseVoiceWithClaude(
  transcript: string,
  apiKey?: string,
): Promise<VoiceBrewFields> {
  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: PROMPT(transcript) }],
  };

  // Build headers — include api key if provided (for local dev fallback path)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '{}';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(cleaned) as VoiceBrewFields;
}
