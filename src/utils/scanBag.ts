export async function scanCoffeeBag(
  imageData: string,
  mediaType: string,
  apiKey: string,
): Promise<Record<string, string>> {
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
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageData },
            },
            {
              type: 'text',
              text: `Extract coffee details from this bag image. Return ONLY a JSON object with these fields (omit any you cannot clearly read from the bag):
- roaster (roaster or company name)
- coffeeName (the specific coffee or product name, e.g. "Buttercream", "Guji Natural", "El Vergel")
- producer (farm or producer name if different from roaster)
- countryOrigin (origin country e.g. "Ethiopia")
- region (farm or region e.g. "Yirgacheffe")
- processingMethod (processing method — use standard names like Washed, Natural, Honey, Anaerobic, Thermal Shock, Wet-Hulled, or the exact text on the bag)
- roastLevel (exactly one of: Light, Light-Medium, Medium, Medium-Dark, Dark)
- varietal (variety e.g. "Heirloom", "Bourbon", "Gesha")
- elevation (e.g. "1800-2200 masl")
- tastingNotes (flavor descriptors from the bag, as a single comma-separated string)

Return ONLY valid JSON. No markdown fences, no explanation.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '{}';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(cleaned);
}
