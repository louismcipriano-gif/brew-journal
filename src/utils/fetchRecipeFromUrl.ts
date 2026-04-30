/**
 * Fetch and extract brew recipe parameters from any URL —
 * YouTube descriptions, blog posts, roaster recipe pages, etc.
 */

export interface RecipeUrlFields {
  name?: string;
  source?: string;
  brewMethod?: string;
  brewingDevice?: string;
  filter?: string;
  grindSize?: string;
  coffeeDose?: number;
  waterAmount?: number;
  waterTempF?: number;
  waterPPM?: number;
  waterRecipe?: string;
  totalPours?: number;
  bloomAmount?: number;
  bloomTime?: number;
  totalBrewTime?: number;
  pourHeight?: string;
  pourSpeed?: string;
  pourStyle?: string;
  agitation?: string;
  pourSpeedMlS?: string;
  pourSpeedMinMlS?: number;
  pourSpeedMaxMlS?: number;
  melodrip?: boolean;
  doubleBloom?: boolean;
  varyingPourSpeed?: boolean;
  recipeDetails?: string;
  espressoYield?: number;
  espressoBrewTime?: number;
  espressoMaxPressure?: number;
}

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
const GRIND_SIZES = ['Fine Espresso', 'Coarse Espresso', 'Fine / Mokka', 'Medium Fine', 'Medium', 'Medium Coarse', 'Coarse'];

const EXTRACT_PROMPT = (text: string) => `You are a specialty coffee recipe parser. Extract every brew recipe parameter from this page content.

Known brewing devices (fuzzy match → return exact string): ${JSON.stringify(KNOWN_DEVICES)}
Known filters (fuzzy match → return exact string): ${JSON.stringify(KNOWN_FILTERS)}
Known grind sizes (return exact string): ${JSON.stringify(GRIND_SIZES)}

Return ONLY valid JSON — no markdown, no explanation. Omit any field not found:
{
  "name": string (recipe name or descriptive title, e.g. "Hoffmann 4-6 Method"),
  "source": string (author or creator, e.g. "James Hoffmann", "Scott Rao", "Onyx Coffee Lab"),
  "brewMethod": "Pour Over" | "Espresso" | "Immersion" | "AeroPress" | "Zuppa Longa",
  "brewingDevice": string,
  "filter": string,
  "grindSize": string,
  "coffeeDose": number (grams),
  "waterAmount": number (grams — convert ml 1:1),
  "waterTempF": number (convert °C → °F if needed),
  "waterPPM": number,
  "waterRecipe": string,
  "totalPours": number,
  "bloomAmount": number (grams),
  "bloomTime": number (minutes — convert from seconds if needed),
  "totalBrewTime": number (minutes — convert from seconds if needed),
  "pourHeight": "Low" | "Medium" | "High",
  "pourSpeed": "Low" | "Medium" | "High" | "Combination",
  "pourStyle": "Circular" | "Center" | "Hybrid",
  "agitation": "Low" | "Medium" | "High",
  "pourSpeedMlS": "1–3" | "4–6" | "6–8" | "8–10" | "10+" | "Combination",
  "pourSpeedMinMlS": number,
  "pourSpeedMaxMlS": number,
  "melodrip": boolean,
  "doubleBloom": boolean,
  "varyingPourSpeed": boolean,
  "recipeDetails": string (full step-by-step instructions exactly as written, preserving timing and weights),
  "espressoYield": number (grams),
  "espressoBrewTime": number (seconds),
  "espressoMaxPressure": number (bar)
}

Page content:
${text}`;

export async function fetchRecipeFromUrl(
  url: string,
  apiKey?: string,
  screenshotKey?: string,
): Promise<RecipeUrlFields> {
  if (!apiKey) {
    throw new Error('No Anthropic API key configured. Go to Settings → AI Features to add one.');
  }

  // Fetch text + screenshot in parallel
  const [shopifyResult, htmlResult, screenshotResult] = await Promise.allSettled([
    fetchPageText(url),
    fetchHtmlMeta(url),
    screenshotKey ? takeScreenshot(url, screenshotKey) : Promise.reject('no key'),
  ]);

  const textParts: string[] = [];
  if (shopifyResult.status === 'fulfilled' && shopifyResult.value) textParts.push(shopifyResult.value);
  if (htmlResult.status === 'fulfilled' && htmlResult.value) textParts.push(htmlResult.value);
  const pageText = textParts.join('\n\n---\n\n').slice(0, 8000);

  // Vision path
  if (screenshotResult.status === 'fulfilled') {
    try {
      return await callClaude(apiKey, [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: screenshotResult.value } },
        { type: 'text', text: pageText ? `${EXTRACT_PROMPT('')}\n\nAdditional text:\n${pageText}` : EXTRACT_PROMPT('(see image above)') },
      ]);
    } catch {
      // fall through to text
    }
  }

  if (!pageText.trim()) throw new Error('Could not load the page. Check the URL and your connection.');

  return await callClaude(apiKey, [{ type: 'text', text: EXTRACT_PROMPT(pageText) }]);
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxy, { signal: AbortSignal.timeout(14000) });
    if (!resp.ok) return '';
    const html = await resp.text();
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script,style,nav,footer,header,[aria-hidden],noscript').forEach((el) => el.remove());
    div.querySelectorAll('p,li,br,h1,h2,h3,h4,td,th').forEach((el) => el.insertAdjacentText('afterend', '\n'));
    return (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000);
  } catch { return ''; }
}

async function fetchHtmlMeta(url: string): Promise<string> {
  try {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxy, { signal: AbortSignal.timeout(14000) });
    if (!resp.ok) return '';
    const html = await resp.text();
    const parts: string[] = [];
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (title?.[1]) parts.push(`Page title: ${title[1].trim()}`);
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
    if (metaDesc?.[1]) parts.push(`Meta description: ${metaDesc[1]}`);
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i);
    if (ogDesc?.[1]) parts.push(`OG description: ${ogDesc[1]}`);
    return parts.join('\n');
  } catch { return ''; }
}

async function takeScreenshot(url: string, accessKey: string): Promise<string> {
  const params = new URLSearchParams({
    access_key: accessKey, url,
    format: 'jpg', response_type: 'by_format',
    viewport_width: '1280', viewport_height: '1400',
    full_page: 'false', image_quality: '80',
    block_ads: 'true', block_cookie_banners: 'true', delay: '1',
  });
  const resp = await fetch(`https://api.screenshotone.com/take?${params}`, { signal: AbortSignal.timeout(25000) });
  if (!resp.ok) throw new Error(`Screenshot ${resp.status}`);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function callClaude(apiKey: string, content: any[]): Promise<RecipeUrlFields> {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1536,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error?.message ?? `API error ${response.status}`);
  }
  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '{}';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(cleaned) as RecipeUrlFields;
}
