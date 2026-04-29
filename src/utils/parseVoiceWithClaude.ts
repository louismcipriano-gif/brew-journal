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
  // Brew setup
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
  waterRecipe?: string;
  brewRecipeName?: string;
  quickScore?: number;
  brewRecipeDetails?: string;
  // Measurements
  finalBrewWeight?: number;
  tds?: number;
  extractionYield?: number;
  // Pour over details
  totalPours?: number;
  bloomAmount?: number;
  bloomTime?: number;
  totalBrewTime?: number;
  pourHeight?: 'Low' | 'Medium' | 'High';
  pourSpeed?: 'Low' | 'Medium' | 'High' | 'Combination';
  agitation?: 'Low' | 'Medium' | 'High';
  pourSpeedMlS?: string;
  pourSpeedMinMlS?: number;
  pourSpeedMaxMlS?: number;
  melodrip?: boolean;
  doubleBloom?: boolean;
  varyingPourSpeed?: boolean;
  // Espresso details
  espressoYield?: number;
  espressoBrewTime?: number;
  espressoMaxPressure?: number;
  // Flavor profile sliders (0–10)
  acidity?: number;
  sweetness?: number;
  body?: number;
  florality?: number;
  clarity?: number;
  juiciness?: number;
  finish?: number;
  astringency?: number;
  sourness?: number;
  // Flavor profile text & tags
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

const PROMPT = (transcript: string) => `You are a specialty coffee brew log parser. A barista just described their brew session aloud. Extract every piece of information you can find.

SLIDER SCALE — map spoken descriptors to 1–10:
  "none / zero / not present" → 0–1
  "low / mild / slight" → 2–3
  "medium / moderate / decent" → 4–6
  "high / good / strong / bright" → 7–8
  "very high / excellent / intense / incredible" → 9–10

BOOLEAN FIELDS — set true if mentioned/used, false if explicitly absent ("no melodrip", "didn't use", "skipped"):
  melodrip: used Melodrip flow restrictor
  doubleBloom: did a second bloom / double bloom
  varyingPourSpeed: varied pour speed during the brew

PERCEIVED EXTRACTION hints:
  "under" / "underextracted" / "sour" / "sharp" → "Under"
  "balanced" / "dialled in" / "on point" → "Balanced"
  "over" / "overextracted" / "bitter" / "harsh" → "Over"

Known brewing devices (fuzzy match → return exact string): ${JSON.stringify(KNOWN_DEVICES)}
Known filters (fuzzy match → return exact string): ${JSON.stringify(KNOWN_FILTERS)}
Known grinders (fuzzy match → return exact string): ${JSON.stringify(KNOWN_GRINDERS)}
Known grind sizes (return exact string): ${JSON.stringify(GRIND_SIZES)}

Return ONLY valid JSON — no markdown, no explanation. Omit any field not mentioned.
{
  "brewMethod": "Pour Over" | "Espresso" | "Immersion" | "AeroPress" | "Zuppa Longa",
  "brewingDevice": string,
  "grinder": string,
  "grindSetting": string,
  "grindSize": string,
  "filter": string,
  "brewerShape": "Cone" | "Flat",
  "bypass": "Standard" | "Low Bypass" | "No Bypass",
  "pourStyle": "Circular" | "Center" | "Hybrid",
  "coffeeDose": number (grams),
  "waterAmount": number (grams),
  "waterTempF": number (convert °C → °F if needed),
  "waterPPM": number,
  "waterRecipe": string,
  "brewRecipeName": string,
  "quickScore": number 1-5,
  "brewRecipeDetails": string (step-by-step pour instructions, timing, or any technique notes spoken),
  "finalBrewWeight": number (grams — total liquid in cup),
  "tds": number (TDS percentage, e.g. 1.35),
  "extractionYield": number (extraction yield %, e.g. 21.5),
  "totalPours": number,
  "bloomAmount": number (grams),
  "bloomTime": number (minutes),
  "totalBrewTime": number (minutes — convert from seconds if needed),
  "pourHeight": "Low" | "Medium" | "High",
  "pourSpeed": "Low" | "Medium" | "High" | "Combination",
  "agitation": "Low" | "Medium" | "High",
  "pourSpeedMlS": one of "1–3" | "4–6" | "6–8" | "8–10" | "10+" | "Combination" (match from spoken ml/s range),
  "pourSpeedMinMlS": number (ml/s, for Combination only),
  "pourSpeedMaxMlS": number (ml/s, for Combination only),
  "melodrip": boolean,
  "doubleBloom": boolean,
  "varyingPourSpeed": boolean,
  "espressoYield": number (grams),
  "espressoBrewTime": number (seconds),
  "espressoMaxPressure": number (bar),
  "acidity": number 0-10,
  "sweetness": number 0-10,
  "body": number 0-10,
  "florality": number 0-10,
  "clarity": number 0-10,
  "juiciness": number 0-10,
  "finish": number 0-10,
  "astringency": number 0-10,
  "sourness": number 0-10,
  "flavorNotes": string (tasting descriptors exactly as spoken),
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
    max_tokens: 1536,
    messages: [{ role: 'user', content: PROMPT(transcript) }],
  };

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
