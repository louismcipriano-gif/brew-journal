export async function fetchCoffeeFromUrl(
  url: string,
  apiKey?: string,
): Promise<Record<string, string>> {
  let pageText = '';

  // ── 1. Try Shopify product JSON (works without a proxy — Shopify sets CORS *) ──
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
          const div = document.createElement('div');
          div.innerHTML = p.body_html ?? '';
          const bodyText = (div.textContent ?? '').replace(/\s+/g, ' ').trim();
          const tags = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags ?? '');
          pageText = [
            `Product title: ${p.title}`,
            `Vendor/Roaster: ${p.vendor}`,
            `Tags: ${tags}`,
            `Description: ${bodyText}`,
          ].join('\n').slice(0, 6000);
        }
      }
    } catch { /* fall through */ }
  }

  // ── 2. CORS proxy fallback for non-Shopify or failed JSON fetch ─────────────
  if (!pageText) {
    try {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const resp = await fetch(proxy, { signal: AbortSignal.timeout(12000) });
      if (resp.ok) {
        const html = await resp.text();
        const div = document.createElement('div');
        div.innerHTML = html;
        div.querySelectorAll('script, style, nav, footer, header, [aria-hidden]').forEach((el) => el.remove());
        pageText = (div.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 6000);
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
          content: `Extract coffee details from this product page. Return ONLY a JSON object with these fields (omit any you cannot find):
- roaster (roaster or company name)
- coffeeName (the specific coffee or product name, e.g. "Buttercream", "La Capilla", "Querocoto")
- producer (farm or producer name, if different from roaster)
- countryOrigin (origin country e.g. "Ethiopia")
- region (specific region, village, or farm area)
- processingMethod (processing method — use standard names like Washed, Natural, Honey, Anaerobic, Thermal Shock, Wet-Hulled, or the exact text from the page)
- roastLevel (exactly one of: Light, Light-Medium, Medium, Medium-Dark, Dark)
- varietal (coffee variety e.g. "Heirloom", "Gesha", "Bourbon", "Typica")
- elevation (e.g. "1800-2200 masl")
- tastingNotes (roaster's flavor descriptors, comma-separated string)

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
