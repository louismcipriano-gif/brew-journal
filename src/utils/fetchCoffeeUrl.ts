export async function fetchCoffeeFromUrl(
  url: string,
  apiKey?: string,
): Promise<Record<string, string>> {
  let pageText = '';

  // ── 1. Shopify product JSON (CORS * — no proxy needed) ──────────────────────
  const productMatch = url.match(/\/products\/([^/?#]+)/);
  if (productMatch) {
    try {
      const handle = productMatch[1];
      const origin = new URL(url).origin;
      const jsonUrl = `${origin}/products/${handle}.json`;
      const resp = await fetch(jsonUrl, { signal: AbortSignal.timeout(7000) });
      if (resp.ok) {
        const json = await resp.json();
        const p = json?.product;
        if (p) {
          // Body HTML → readable text (preserve line breaks between elements)
          const div = document.createElement('div');
          div.innerHTML = p.body_html ?? '';
          // Insert newlines so block elements don't smash together
          div.querySelectorAll('p,li,br,h1,h2,h3,h4,td,th').forEach((el) => {
            el.insertAdjacentText('afterend', '\n');
          });
          const bodyText = (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();

          // Tags (often contain process, origin, roast level, tasting notes)
          const tags = Array.isArray(p.tags)
            ? p.tags.join(', ')
            : (p.tags ?? '');

          // Price & bag size from variants
          const variants: any[] = p.variants ?? [];
          const variantLines = variants
            .slice(0, 5)
            .map((v: any) => {
              const parts: string[] = [];
              if (v.title && v.title !== 'Default Title') parts.push(`size: ${v.title}`);
              if (v.price) parts.push(`price: $${v.price}`);
              if (v.weight && v.weight_unit) parts.push(`weight: ${v.weight}${v.weight_unit}`);
              return parts.join(', ');
            })
            .filter(Boolean);

          pageText = [
            `Product title: ${p.title}`,
            `Vendor/Roaster: ${p.vendor}`,
            `Tags: ${tags}`,
            variantLines.length ? `Variants:\n${variantLines.join('\n')}` : '',
            `Description:\n${bodyText}`,
          ]
            .filter(Boolean)
            .join('\n\n')
            .slice(0, 8000);
        }
      }
    } catch { /* fall through */ }
  }

  // ── 2. CORS proxy fallback for non-Shopify / failed JSON ────────────────────
  if (!pageText) {
    try {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const resp = await fetch(proxy, { signal: AbortSignal.timeout(12000) });
      if (resp.ok) {
        const html = await resp.text();
        const div = document.createElement('div');
        div.innerHTML = html;
        div.querySelectorAll('script, style, nav, footer, header, [aria-hidden]').forEach((el) => el.remove());
        div.querySelectorAll('p,li,br,h1,h2,h3,h4,td,th').forEach((el) => {
          el.insertAdjacentText('afterend', '\n');
        });
        pageText = (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000);
      }
    } catch { /* fall through */ }
  }

  if (!pageText) {
    throw new Error('Could not load the page. Check the URL and your internet connection.');
  }

  if (!apiKey) {
    throw new Error('No Anthropic API key configured. Go to Settings → AI Features to add one.');
  }

  // ── 3. Claude extraction ────────────────────────────────────────────────────
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
          content: `Extract coffee product details from this page content. Be thorough — check the description, tags, and all text carefully for tasting notes, elevation, price, and other details.

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
  "tastingNotes": "roaster's flavor descriptors as a comma-separated string (e.g. 'jasmine, peach, honey, brown sugar')",
  "price": "price as a decimal number string (e.g. '24.00') — use the smallest / base variant price",
  "gramsPerBag": "bag weight in grams as an integer string — convert oz to grams (1 oz = 28.35 g), e.g. '250' or '340'"
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
