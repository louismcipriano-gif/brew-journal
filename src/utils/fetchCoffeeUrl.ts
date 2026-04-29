export async function fetchCoffeeFromUrl(
  url: string,
  apiKey?: string,
): Promise<Record<string, string>> {

  // ── Fetch both sources in parallel ─────────────────────────────────────────
  const [shopifyResult, htmlResult] = await Promise.allSettled([
    fetchShopifyJson(url),
    fetchHtmlMeta(url),
  ]);

  const parts: string[] = [];

  if (shopifyResult.status === 'fulfilled' && shopifyResult.value) {
    parts.push(shopifyResult.value);
  }
  if (htmlResult.status === 'fulfilled' && htmlResult.value) {
    parts.push(htmlResult.value);
  }

  const pageText = parts.join('\n\n---\n\n').slice(0, 10000);

  if (!pageText.trim()) {
    throw new Error('Could not load the page. Check the URL and your internet connection.');
  }

  if (!apiKey) {
    throw new Error('No Anthropic API key configured. Go to Settings → AI Features to add one.');
  }

  // ── Claude extraction ───────────────────────────────────────────────────────
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
      messages: [
        {
          role: 'user',
          content: `Extract coffee product details from this page content. Be thorough — the meta description often contains tasting notes and key details in a single sentence.

Return ONLY a valid JSON object with these exact field names. Omit any field you cannot confidently determine:
{
  "roaster": "roaster or company name",
  "coffeeName": "the specific coffee name (e.g. 'Peru Dominga Carrasco' — not the full product title, just the coffee identifier)",
  "producer": "producer, farmer, or cooperative name if mentioned",
  "farm": "specific farm name if mentioned (different from producer)",
  "countryOrigin": "origin country (e.g. 'Ethiopia', 'Peru', 'Colombia')",
  "region": "specific region, department, or growing area",
  "processingMethod": "exactly one of: Washed, Natural, Honey, Washed Anaerobic, Natural/Honey Anaerobic, Thermal Shock, Co-Ferment, Hybrid/Other",
  "roastLevel": "exactly one of: Light, Light-Medium, Medium, Medium-Dark, Dark",
  "varietal": "coffee variety / cultivar (e.g. 'Yellow Caturra', 'Gesha', 'Heirloom')",
  "elevation": "elevation as written on the page (e.g. '1800–2200 masl')",
  "tastingNotes": "roaster's flavor descriptors as a comma-separated string (e.g. 'lime, cherry, florals')",
  "price": "price as a decimal number string — use the smallest / base variant price (e.g. '29.00')",
  "gramsPerBag": "bag weight in grams as an integer string — convert oz to grams (1 oz = 28.35 g) (e.g. '250')"
}

Page content:
${pageText}

Return ONLY valid JSON. No markdown fences, no explanation.`,
        },
      ],
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

// ── Shopify product JSON (price, variants, title, vendor, tags) ─────────────
async function fetchShopifyJson(url: string): Promise<string> {
  const productMatch = url.match(/\/products\/([^/?#]+)/);
  if (!productMatch) return '';

  const handle = productMatch[1];
  const origin = new URL(url).origin;
  const jsonUrl = `${origin}/products/${handle}.json`;
  const resp = await fetch(jsonUrl, { signal: AbortSignal.timeout(7000) });
  if (!resp.ok) return '';

  const json = await resp.json();
  const p = json?.product;
  if (!p) return '';

  // Body HTML → readable text
  const div = document.createElement('div');
  div.innerHTML = p.body_html ?? '';
  div.querySelectorAll('p,li,br,h1,h2,h3,h4,td,th').forEach((el) => {
    el.insertAdjacentText('afterend', '\n');
  });
  const bodyText = (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();

  const tags = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags ?? '');

  // Variants → price and bag size
  const variants: any[] = p.variants ?? [];
  const variantLines = variants
    .slice(0, 5)
    .map((v: any) => {
      const parts: string[] = [];
      if (v.title && v.title !== 'Default Title') parts.push(`size: ${v.title}`);
      if (v.price) parts.push(`price: $${v.price}`);
      return parts.join(', ');
    })
    .filter(Boolean);

  return [
    `[Shopify product JSON]`,
    `Title: ${p.title}`,
    `Vendor: ${p.vendor}`,
    tags ? `Tags: ${tags}` : '',
    variantLines.length ? `Variants:\n${variantLines.join('\n')}` : '',
    bodyText ? `Description:\n${bodyText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── HTML page: meta description, og tags, JSON-LD, visible text ────────────
async function fetchHtmlMeta(url: string): Promise<string> {
  try {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxy, { signal: AbortSignal.timeout(14000) });
    if (!resp.ok) return '';

    const html = await resp.text();
    const parts: string[] = ['[HTML page]'];

    // Meta description (often has the richest one-line summary)
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (metaDesc?.[1]) parts.push(`Meta description: ${decodeHtmlEntities(metaDesc[1])}`);

    // og:description
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDesc?.[1] && ogDesc[1] !== metaDesc?.[1]) {
      parts.push(`OG description: ${decodeHtmlEntities(ogDesc[1])}`);
    }

    // JSON-LD structured data
    const jldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of jldMatches.slice(0, 3)) {
      try {
        const obj = JSON.parse(m[1]);
        const flat = JSON.stringify(obj).slice(0, 800);
        parts.push(`Structured data: ${flat}`);
      } catch { /* skip malformed */ }
    }

    // Visible body text (after removing noise)
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script, style, nav, footer, header, [aria-hidden], noscript').forEach((el) => el.remove());
    div.querySelectorAll('p,li,br,h1,h2,h3,h4,td,th').forEach((el) => {
      el.insertAdjacentText('afterend', '\n');
    });
    const bodyText = (div.textContent ?? '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 3000);
    if (bodyText) parts.push(`Page text:\n${bodyText}`);

    return parts.join('\n');
  } catch {
    return '';
  }
}

function decodeHtmlEntities(str: string): string {
  const div = document.createElement('div');
  div.innerHTML = str;
  return div.textContent ?? str;
}
