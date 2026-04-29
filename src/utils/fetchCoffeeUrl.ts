const EXTRACT_PROMPT = `This is a specialty coffee product page. Extract every coffee detail you can find — check descriptions, labels, tasting note badges, price tags, and any visible text.

Return ONLY a valid JSON object with these exact field names. Omit any field you cannot confidently determine:
{
  "roaster": "roaster or company name",
  "coffeeName": "the specific coffee name (e.g. 'Peru Dominga Carrasco' — not the full product title)",
  "producer": "producer, farmer, or cooperative name if mentioned",
  "farm": "specific farm name if mentioned",
  "countryOrigin": "origin country (e.g. 'Ethiopia', 'Peru', 'Colombia')",
  "region": "specific region, department, or growing area",
  "processingMethod": "exactly one of: Washed, Natural, Honey, Washed Anaerobic, Natural/Honey Anaerobic, Thermal Shock, Co-Ferment, Hybrid/Other",
  "roastLevel": "exactly one of: Ultra Light, Light, Light-Medium, Medium, Medium-Dark, Dark",
  "varietal": "coffee variety / cultivar (e.g. 'Yellow Caturra', 'Gesha', 'Heirloom')",
  "elevation": "elevation as written (e.g. '1800–2200 masl')",
  "tastingNotes": "roaster's flavor descriptors as a comma-separated string (e.g. 'lime, cherry, florals')",
  "price": "price as a decimal number string — smallest / base variant (e.g. '29.00')",
  "gramsPerBag": "bag weight in grams as integer string — convert oz to grams (1 oz = 28.35 g)"
}

Return ONLY valid JSON. No markdown fences, no explanation.`;

export async function fetchCoffeeFromUrl(
  url: string,
  apiKey?: string,
  screenshotKey?: string,
): Promise<Record<string, string>> {
  if (!apiKey) {
    throw new Error('No Anthropic API key configured. Go to Settings → AI Features to add one.');
  }

  // ── Fetch text context (Shopify JSON + HTML meta) always ───────────────────
  const [shopifyResult, htmlResult] = await Promise.allSettled([
    fetchShopifyJson(url),
    fetchHtmlMeta(url),
  ]);

  const textParts: string[] = [];
  if (shopifyResult.status === 'fulfilled' && shopifyResult.value) textParts.push(shopifyResult.value);
  if (htmlResult.status === 'fulfilled' && htmlResult.value) textParts.push(htmlResult.value);
  const pageText = textParts.join('\n\n---\n\n').slice(0, 8000);

  // ── Vision path: screenshot → Claude sees the rendered page ───────────────
  if (screenshotKey) {
    try {
      const base64 = await takeScreenshot(url, screenshotKey);
      return await callClaude(apiKey, [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
        },
        {
          type: 'text',
          text: pageText
            ? `${EXTRACT_PROMPT}\n\nAdditional text data from the page (prices, variants, meta description):\n${pageText}`
            : EXTRACT_PROMPT,
        },
      ]);
    } catch (err) {
      // Screenshot failed — fall through to text-only
      console.warn('Screenshot failed, falling back to text extraction:', err);
    }
  }

  // ── Text-only fallback ─────────────────────────────────────────────────────
  if (!pageText.trim()) {
    throw new Error('Could not load the page. Check the URL and your internet connection.');
  }

  return await callClaude(apiKey, [
    {
      type: 'text',
      text: `${EXTRACT_PROMPT}\n\nPage content:\n${pageText}`,
    },
  ]);
}

// ── ScreenshotOne ─────────────────────────────────────────────────────────────
async function takeScreenshot(url: string, accessKey: string): Promise<string> {
  const params = new URLSearchParams({
    access_key: accessKey,
    url,
    format: 'jpg',
    response_type: 'by_format',
    viewport_width: '1280',
    viewport_height: '1400',
    full_page: 'false',
    image_quality: '80',
    block_ads: 'true',
    block_cookie_banners: 'true',
    delay: '1',
  });

  const resp = await fetch(`https://api.screenshotone.com/take?${params}`, {
    signal: AbortSignal.timeout(25000),
  });

  if (!resp.ok) throw new Error(`Screenshot API error ${resp.status}`);

  const blob = await resp.blob();
  return blobToBase64(blob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Claude call (text or vision) ──────────────────────────────────────────────
async function callClaude(apiKey: string, content: any[]): Promise<Record<string, string>> {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
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
  return JSON.parse(cleaned);
}

// ── Shopify product JSON ───────────────────────────────────────────────────────
async function fetchShopifyJson(url: string): Promise<string> {
  const productMatch = url.match(/\/products\/([^/?#]+)/);
  if (!productMatch) return '';

  const handle = productMatch[1];
  const origin = new URL(url).origin;
  const resp = await fetch(`${origin}/products/${handle}.json`, {
    signal: AbortSignal.timeout(7000),
  });
  if (!resp.ok) return '';

  const json = await resp.json();
  const p = json?.product;
  if (!p) return '';

  const div = document.createElement('div');
  div.innerHTML = p.body_html ?? '';
  div.querySelectorAll('p,li,br,h1,h2,h3,h4,td,th').forEach((el) => el.insertAdjacentText('afterend', '\n'));
  const bodyText = (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();

  const tags = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags ?? '');
  const variants: any[] = p.variants ?? [];
  const variantLines = variants
    .slice(0, 5)
    .map((v: any) => [v.title !== 'Default Title' ? `size: ${v.title}` : '', v.price ? `price: $${v.price}` : ''].filter(Boolean).join(', '))
    .filter(Boolean);

  return [
    '[Shopify product JSON]',
    `Title: ${p.title}`,
    `Vendor: ${p.vendor}`,
    tags ? `Tags: ${tags}` : '',
    variantLines.length ? `Variants:\n${variantLines.join('\n')}` : '',
    bodyText ? `Description:\n${bodyText}` : '',
  ].filter(Boolean).join('\n');
}

// ── HTML page: meta description, og tags, JSON-LD ────────────────────────────
async function fetchHtmlMeta(url: string): Promise<string> {
  try {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxy, { signal: AbortSignal.timeout(14000) });
    if (!resp.ok) return '';

    const html = await resp.text();
    const parts: string[] = ['[HTML page]'];

    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (metaDesc?.[1]) parts.push(`Meta description: ${decodeEntities(metaDesc[1])}`);

    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDesc?.[1] && ogDesc[1] !== metaDesc?.[1]) parts.push(`OG description: ${decodeEntities(ogDesc[1])}`);

    const jldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of jldMatches.slice(0, 3)) {
      try { parts.push(`Structured data: ${JSON.stringify(JSON.parse(m[1])).slice(0, 600)}`); } catch { /* skip */ }
    }

    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script,style,nav,footer,header,[aria-hidden],noscript').forEach((el) => el.remove());
    div.querySelectorAll('p,li,br,h1,h2,h3,h4,td,th').forEach((el) => el.insertAdjacentText('afterend', '\n'));
    const bodyText = (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2500);
    if (bodyText) parts.push(`Page text:\n${bodyText}`);

    return parts.join('\n');
  } catch {
    return '';
  }
}

function decodeEntities(str: string): string {
  const div = document.createElement('div');
  div.innerHTML = str;
  return div.textContent ?? str;
}
