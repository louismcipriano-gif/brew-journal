/**
 * Claude-powered voice transcript parser for brew logs.
 * Sends the raw transcript to Claude and gets back structured brew fields.
 * Supports both one-shot and streaming (SSE) modes.
 */

const KNOWN_DEVICES = [
  'V60', 'Orea 01', 'Orea Z1', 'V60 Switch', 'Mugen Switch',
  'Cafec Flower', 'Kalita Wave', 'Origami Cone', 'Origami Flat',
  'Cafec Deep 27', 'Melodrip Column', 'Kono', 'April Brewer',
  'Hario Mugen', 'Hario Cloth', 'Torch Mountain', 'Orea V3',
  'OXO Rapid Brewer', 'Flair 58', 'French Press', 'Mokka Pot',
  'Gabi Master A',
];
const KNOWN_FILTERS = [
  'Cafec T-90', 'T-92', 'Abaca', 'Deep 27', 'Sibarist Z1',
  'Orea Flat', 'Origami Wave', 'Kalita Wave', 'April Wave', 'Kono', 'Melodrip Column',
];
const KNOWN_GRINDERS = ['Timemore Sculptor 078', 'Comandante C40', 'Niche Zero', 'A4Z'];
const GRIND_SIZES = ['Fine Espresso', 'Coarse Espresso', 'Fine / Mokka', 'Medium Fine', 'Medium', 'Medium Coarse', 'Coarse'];

export interface VoiceBrewFields {
  // Brew setup
  brewDate?: string;  // YYYY-MM-DD resolved from relative phrases
  brewMethod?: string;
  brewingDevice?: string;
  grinder?: string;
  grindSetting?: number;
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

// ── Few-shot examples ─────────────────────────────────────────────────────────
// Two realistic transcript → JSON pairs that show the parser how to handle
// natural fast speech, coffee jargon, and qualitative tasting language.

const FEW_SHOT = `
EXAMPLES — follow these patterns exactly:

Example 1 (setup pass — fast natural speech with filler words):
Transcript: "ok so uh V60 today with the t-90 filter, on the timemore sculptor at like 7.5 clicks, 15 grams in 240 out, water was 205. did four pours, bloom was 45 grams for about 45 seconds, total brew time maybe three and a half minutes, pour height medium, no melodrip"
Output: {"brewMethod":"Pour Over","brewingDevice":"V60","filter":"Cafec T-90","grinder":"Timemore Sculptor 078","grindSetting":7.5,"grindSize":"Medium Fine","coffeeDose":15,"waterAmount":240,"waterTempF":205,"totalPours":4,"bloomAmount":45,"bloomTime":0.75,"totalBrewTime":3.5,"pourHeight":"Medium","melodrip":false}

Example 2 (tasting pass — qualitative language, self-correction, next-brew intent):
Transcript: "tasting now - really clean and bright, acidity is super high like a five, sweetness is decent maybe a three, body is pretty low. floral, jasmine and peach, some honey finish. actually wait the finish is really nice, like a four. felt a bit underextracted, want more sweetness next time, grind finer by a click or two"
Output: {"acidity":5,"sweetness":3,"body":2,"florality":4,"clarity":4,"finish":4,"flavorNotes":"jasmine, peach, honey finish","perceivedExtraction":"Under","moreSweetness":true,"suggestedChange":"grind finer by 1-2 clicks"}
`;

// ── Prompt ────────────────────────────────────────────────────────────────────

const PROMPT = (
  transcript: string,
  knownRecipes: string[] = [],
  today: string = new Date().toISOString().split('T')[0],
) => `You are a specialty coffee brew log parser. A barista just described their brew session aloud. Extract every piece of information you can find. Ignore filler words ("um", "uh", "like", "you know"). Handle self-corrections — use the corrected value.
${FEW_SHOT}
TODAY'S DATE: ${today}
BREW DATE: If the user mentions when they brewed ("yesterday", "this was Sunday's brew", "last Friday", "two days ago", "brewed today", "on Tuesday"), resolve to YYYY-MM-DD using today (${today}) as reference.

SLIDER SCALE — map spoken descriptors to 1–5:
  "none / zero / not present" → 1
  "low / mild / slight" → 2
  "medium / moderate / decent" → 3
  "high / good / strong / bright" → 4
  "very high / excellent / intense / incredible" → 5

BOOLEAN FIELDS — set true if mentioned/used, false if explicitly absent ("no melodrip", "didn't use", "skipped"):
  melodrip: used Melodrip flow restrictor
  doubleBloom: did a second bloom / double bloom
  varyingPourSpeed: varied pour speed during the brew

PERCEIVED EXTRACTION hints:
  "under" / "underextracted" / "sour" / "sharp" → "Under"
  "balanced" / "dialled in" / "on point" → "Balanced"
  "over" / "overextracted" / "bitter" / "harsh" → "Over"

Known saved recipes (fuzzy match → return exact string): ${JSON.stringify(knownRecipes)}
Known brewing devices (fuzzy match → return exact string): ${JSON.stringify(KNOWN_DEVICES)}
Known filters (fuzzy match → return exact string): ${JSON.stringify(KNOWN_FILTERS)}
Known grinders (fuzzy match → return exact string): ${JSON.stringify(KNOWN_GRINDERS)}
Known grind sizes (return exact string): ${JSON.stringify(GRIND_SIZES)}

Return ONLY valid JSON — no markdown, no explanation. Omit any field not mentioned.
{
  "brewDate": "YYYY-MM-DD — only if the user mentions when they brewed",
  "brewMethod": "Pour Over" | "Espresso" | "Immersion" | "AeroPress" | "Zuppa Longa",
  "brewingDevice": string,
  "grinder": string,
  "grindSetting": number (numeric value only — clicks, steps, or dial position; no units),
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
  "pourSpeedMlS": one of "1–3" | "4–6" | "6–8" | "8–10" | "10+" | "Combination",
  "pourSpeedMinMlS": number (ml/s, for Combination only),
  "pourSpeedMaxMlS": number (ml/s, for Combination only),
  "melodrip": boolean,
  "doubleBloom": boolean,
  "varyingPourSpeed": boolean,
  "espressoYield": number (grams),
  "espressoBrewTime": number (seconds),
  "espressoMaxPressure": number (bar),
  "acidity": number 1-5,
  "sweetness": number 1-5,
  "body": number 1-5,
  "florality": number 1-5,
  "clarity": number 1-5,
  "juiciness": number 1-5,
  "finish": number 1-5,
  "astringency": number 1-5,
  "sourness": number 1-5,
  "flavorNotes": string (tasting descriptors as spoken, cleaned of filler),
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanJson(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

/**
 * Extract completed key:value pairs from a partial JSON string using regex.
 * Works for strings, numbers, and booleans — nested objects arrive in the
 * final full parse. Only fires once per unique key (tracks last seen value).
 */
export function extractPartialFields(
  text: string,
  lastSeen: Record<string, unknown>,
): Partial<VoiceBrewFields> {
  const result: Record<string, unknown> = {};
  // Match "key": "string" | number | boolean
  const re = /"(\w+)":\s*("[^"]*"|-?\d+(?:\.\d+)?|true|false)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1];
    const raw = m[2];
    let val: unknown;
    if (raw === 'true')        val = true;
    else if (raw === 'false')  val = false;
    else if (raw.startsWith('"')) val = raw.slice(1, -1);
    else                       val = parseFloat(raw);

    // Only emit if this is a new or updated value for this key
    if (lastSeen[key] !== val) {
      result[key] = val;
      lastSeen[key] = val;
    }
  }
  return result as Partial<VoiceBrewFields>;
}

// ── One-shot parse (non-streaming fallback) ───────────────────────────────────

export async function parseVoiceWithClaude(
  transcript: string,
  apiKey?: string,
  knownRecipes: string[] = [],
  today?: string,
): Promise<VoiceBrewFields> {
  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1536,
    messages: [{ role: 'user', content: PROMPT(transcript, knownRecipes, today) }],
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
  return JSON.parse(cleanJson(text)) as VoiceBrewFields;
}

// ── Streaming parse ───────────────────────────────────────────────────────────

/**
 * Streams Claude's response and calls onPartialFields each time new key:value
 * pairs become parseable from the accumulating JSON text.
 * Returns the complete final VoiceBrewFields (including nested objects like
 * pourOverDetails that don't appear until the full JSON is ready).
 *
 * Falls back to one-shot parse if the environment doesn't support ReadableStream.
 */
export async function parseVoiceWithClaudeStream(
  transcript: string,
  onPartialFields: (fields: Partial<VoiceBrewFields>) => void,
  apiKey?: string,
  knownRecipes: string[] = [],
  today?: string,
): Promise<VoiceBrewFields> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1536,
      stream: true,
      messages: [{ role: 'user', content: PROMPT(transcript, knownRecipes, today) }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error?.message || `API error ${response.status}`);
  }

  // Fallback: if the proxy didn't stream (e.g. older Vercel runtime), parse normally
  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('event-stream') || !response.body) {
    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? '{}';
    const fields = JSON.parse(cleanJson(text)) as VoiceBrewFields;
    onPartialFields(fields); // fire once with everything
    return fields;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  const lastSeen: Record<string, unknown> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });

    // Each SSE chunk may contain multiple lines; process them all
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;

      let event: any;
      try { event = JSON.parse(payload); } catch { continue; }

      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        accumulated += event.delta.text;

        // Try to extract newly completed fields from partial JSON
        const partial = extractPartialFields(accumulated, lastSeen);
        if (Object.keys(partial).length > 0) {
          onPartialFields(partial);
        }
      }
    }
  }

  // Final authoritative parse — catches nested objects (pourOverDetails, etc.)
  // that the regex can't extract mid-stream
  return JSON.parse(cleanJson(accumulated)) as VoiceBrewFields;
}
