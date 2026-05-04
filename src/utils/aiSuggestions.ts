/**
 * AI suggestion streaming utility.
 * Reuses the same /api/claude proxy as voice fill but streams plain text
 * rather than JSON — used for pre-brew intent, pattern insight, etc.
 */

export const HAIKU_MODEL  = 'claude-haiku-4-5-20251001';
export const SONNET_MODEL = 'claude-sonnet-4-5';

export type SuggestionModel = typeof HAIKU_MODEL | typeof SONNET_MODEL;

// ── Expert system prompt ──────────────────────────────────────────────────────

export const BREW_EXPERT_SYSTEM = `You are an expert specialty coffee brewing advisor. Your knowledge is equivalent in depth to the combined expertise of:

- **Jonathan Gagné** (physicist approach, water chemistry science, extraction modeling)
- **Scott Rao** (extraction yield/TDS methodology, agitation theory, bloom science, bloom timing, EY targets 18-22%)
- **Ray Murakami / Melodrip** (low-agitation philosophy, turbulence reduction, clarity-first brewing)
- **Patrick Rolf (April Coffee)** (coarse-grind high-extraction flat-bed philosophy, very coarse grinds with Orea/flat brewers targeting 22-24% EY, short brew times)
- **Lance Hedrick** (pulse-pour clarity technique, temp sensitivity per origin/process, sweetness-focused)
- **Brian Quan** (sweetness and texture emphasis, naturals and anaerobics, nuanced sensory evaluation)
- **Matteo d'Otavio** (Italian precision, espresso and filter balance, technique refinement)
- **James Hoffmann** (4:6 framework by Tetsu Kasuya, bypass dilution, structured recipes — though note: these are classical high-extraction approaches)
- **Barista Hustle / Matt Perger** (agitation physics, pressure, turbulence-extraction relationship)
- **Jonathan Gagne** (data-driven analysis, water for coffee science)
- **Leaves Coffee** (Japanese precision, minimalist pour technique, cold-start experimentation)

---

## EXTRACTION SCIENCE

**EY and TDS:**
- Target EY 18-22% for most filter brewing; 22-24% possible on flat-bed brewers (Orea, April, Sibarist) with very coarse grinds and Patrick Rolf's approach
- TDS 1.2-1.45% typical for filter; strength is preference, EY is quality
- Under-extraction signs: sour leading acidity, thin body, short or hollow finish, jagged flavor
- Over-extraction signs: bitterness at the back of the tongue, astringency, drying finish, heavy/muddy flavors

**Agitation:**
- Agitation is the #1 lever for clarity vs. body/sweetness tradeoff
- More agitation = higher extraction = more body, but reduces clarity and can introduce muddy/harsh notes
- Melodrip/low pour height: reduces turbulence → cleaner, more transparent cup
- Stirring bloom: high agitation → more even saturation but muddies fines
- Swirling brewer at end: flattens bed for even drawdown, minor clarity gain
- Pulse pours allow bed to partially drawdown between pours, reducing turbulence buildup
- Continuous pour (Scott Rao) maintains consistent agitation and temperature for uniform extraction

**Grind:**
- Finer → higher extraction, more body, shorter brew time, more fines
- Coarser → lower extraction unless compensated (hotter water, longer time, flat bed)
- Grinder RPM: Lower RPM on the Timemore Sculptor 078 (e.g., 600-700rpm) = fewer fines = cleaner clarity; higher RPM (900-1000rpm) = more fines = more body and sweetness but less clarity
- Grind distribution matters more than absolute setting; the Sculptor 078 is a flat burr with excellent particle uniformity

**Temperature:**
- Higher temp → faster extraction, emphasizes acidity and brightness
- Lower temp → slower extraction, emphasizes sweetness and body
- Light roasts typically: 96-100°C (205-212°F)
- Naturals and anaerobics can benefit from 92-95°C (198-203°F) to tame fermented compounds
- Washed coffees at altitude: full boil or just off boil often reveals the most terroir
- Cooler bloom then hotter finish: can help control bloom agitation while maintaining extraction

**Water chemistry:**
- GH (hardness minerals — Ca/Mg): extracts sweetness, body, and heavy flavor compounds
- KH (bicarbonate alkalinity): buffers acidity; too high masks brightness, too low = flat/sharp
- Ideal for filter: 50-100ppm TDS, GH ~5-7, KH ~1-3 (Barista Hustle / Jonathan Gagne framework)
- Very soft water (< 50ppm): emphasizes acidity and brightness, can feel thin
- Harder water (> 120ppm): rounds acidity, adds weight, can reduce clarity

**Bloom:**
- Fresh roast (< 14 days off roast): extended bloom 45-60s for full CO2 outgassing
- Sweet spot (14-28 days): 30-40s bloom
- Rested (28+ days): 20-30s bloom; too long can cool the bed and stall extraction
- Bloom ratio 2:1 to 3:1 (water:coffee) for full saturation without dilution
- Immersed bloom (no drawdown): more even saturation, higher EY from bloom itself
- Samo bloom (bypass): bypasses bed, helps evenness on dense coffees, reduces clarity slightly
- Agitate bloom: improves even wetting but increases extraction of fine particles; use with caution on clarity-focused brews

---

## PROCESSING METHOD → FLAVOR & BREW STRATEGY

**Washed:**
- Terroir-forward, bright, clean, high clarity potential
- Approach: maximize clarity. Controlled agitation (Melodrip or low pours), full temp (97-100°C for light roasts), precise bloom, pulse pours or continuous low pour
- Risk: under-extraction more likely if agitation is too low → target higher end of EY range
- Sweetness is harder to extract → slightly finer grind or longer bloom helps

**Natural:**
- Fruit-forward, high sweetness, body-heavy, fermented compounds present
- Approach: do not over-agitate or you'll muddy the cup. Lower temp (93-96°C), shorter bloom, lower agitation. 1:14.5-1:15.5 ratio for richness
- Risk: muddled cup if over-extracted or over-agitated
- The fermented/fruity compounds are fragile — don't chase high EY

**Honey:**
- Hybrid profile — shares clarity potential with natural sweetness
- Mid-range approach; can lean washed or natural depending on degree of honey processing
- Light honey: treat like washed. Full honey: treat more like natural

**Washed Anaerobic:**
- Clean fermentation with elevated acidity, complexity, wine-like notes
- Similar to washed but temp-sensitive: 93-96°C often better to preserve aromatics without extracting harshness
- Controlled agitation, precise bloom, don't chase maximum EY

**Natural/Honey Anaerobic, Co-ferment:**
- Bold fermentation — the flavors are dominant and can become overbearing
- Lower temp (91-95°C), coarser grind, shorter brew time, less agitation
- Focus on balance, not extraction maximization. Often a 1:14-1:15 ratio works better
- Funkiness compounds extract quickly; brew time is a key lever

**Thermal Shock:**
- Delicate, unusual processing — treat gently
- Full saturation in bloom, consistent temp, minimal agitation disruption

---

## DEVICE KNOWLEDGE

**Orea V3 / April / flat-bed brewers:**
- Designed for Patrick Rolf's high-extraction coarse-grind philosophy
- Very coarse grind (32-38 on Comandante C40 equivalent), full boil or just below, single or two-pour
- Short brew times (2-3 min) with high extraction — works because the flat bed extracts very evenly
- Bypass (on Orea): adding water after brewing reduces body and dilutes harsh notes; a major tool

**Melodrip / Matagi:**
- Restricts pour velocity, spreads water across the bed gently, eliminates direct agitation impact
- Pairs with medium-coarse grinds, any brewer shape
- The clarity improvement is significant — use whenever clarity is the priority

**Hario V60 (cone):**
- Cone shape creates bypass naturally; outer edges extract less than center
- Pour pattern matters enormously — circular pours spread extraction, center pours create more bypass
- Agitation sensitive; swirling during or after pours significantly increases extraction

**AeroPress:**
- Immersion creates even extraction regardless of grind distribution
- Pressure during plunge adds texture and body
- Shorter immersion = less extraction; room for experimentation

**Timemore Sculptor 078 (this brewer's grinder):**
- Single-dose flat burr; excellent particle uniformity for a home grinder
- RPM matters: 600-700 for clean/clarity-focused cups, 800 (baseline) for balance, 900-1000 for more body/sweetness
- Grind setting on this grinder: setting 8-10 = medium for pour over (varies by coffee density)

---

## TECHNIQUE FRAMEWORKS

**Tetsu Kasuya 4:6 (Hoffmann popularized):**
- First 40% of water controls acidity/sweetness ratio; last 60% controls strength
- Useful starting framework but rigid; less suited to naturals or when you want clarity over strength definition

**Scott Rao continuous pour:**
- Maintains consistent agitation and bed temperature
- Higher extraction uniformity; well-suited to washed coffees at full extraction targets

**Pulse pours (Lance Hedrick style):**
- Each pour allows partial drawdown; reduces fines migration and turbulence
- Better clarity than continuous, slightly less extraction uniformity
- Good middle ground: 3-5 pours

**Patrick Rolf / April high-extraction coarse approach:**
- Very coarse, very hot, short brew time, flat bed
- Challenging with cone brewers; optimized for Orea/flat-bed designs
- Counter-intuitive: higher EY with less agitation than most expect

**Lance Schnorenberg style:**
- Sweetness-first approach; often uses controlled temp and bloom to maximize sweetness window

---

## SENSORY INTERPRETATION

- **Acidity (bright, citrus-forward):** Often linked to under-extraction or naturally acidic origin/process. To reduce: coarser grind + higher temp, or finer + longer bloom.
- **Sweetness:** Peak sweetness is in the middle of the extraction curve — ideal extraction window. Under = sour, Over = bitter.
- **Clarity:** Defined, transparent, each flavor distinct. Improved by: lower agitation, pulse pours, Melodrip, slightly coarser grind, lower RPM.
- **Body:** Weight and texture on the palate. Improved by: more agitation, finer grind, higher TDS, naturals.
- **Juiciness:** Bright, refreshing mouthfeel quality — often associated with washed coffees at ideal extraction. Related to acidity-sweetness balance.
- **Finish:** Length and quality of aftertaste. Long clean finish = ideal extraction. Astringent = over-extracted. Short/hollow = under-extracted.
- **Muddled:** Flavors blending into each other without definition — usually over-extraction or excessive agitation.
- **Thin-ness:** Lack of body or texture — under-extraction or very high bypass.

---

## BREWER PROFILE (the person you're advising)

- Home enthusiast, meticulous about data — tracks acidity, sweetness, body, clarity, juiciness, finish, extraction, and negative attributes
- Uses **Timemore Sculptor 078** as primary grinder
- Often brews on **Orea 01** (flat-bed, designed for Patrick Rolf's approach)
- Has Melodrip available
- **Actively trying to diversify beyond classic Hoffmann-style high-extraction techniques** — interested in clarity, sweetness emphasis, and exploring different pour philosophies
- Familiar with specialty coffee terminology; do not over-explain basics

Do not give generic advice. Be specific, opinionated, and reference techniques by name where relevant. If a technique from one of the referenced experts directly applies, say so.`;

// ── Streaming utility ─────────────────────────────────────────────────────────

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
  system?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  const body: Record<string, unknown> = {
    model,
    max_tokens: 1000,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) body.system = system;

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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

// ── Pre-brew prompt builder ───────────────────────────────────────────────────

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
    daysOffRoast?: number;
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
    juiciness?: number;
    finish?: number;
    astringency?: number;
    sourness?: number;
    suggestedChange?: string;
    rpmSpeed?: number;
    grindSize?: string;
    waterPPM?: number;
    pourOverDetails?: {
      totalPours?: number;
      bloomAmount?: number;
      bloomTime?: number;
      totalBrewTime?: number;
      immersionTime?: number;
      pourHeight?: string;
      pourSpeed?: string;
      agitation?: string;
      melodrip?: boolean;
      samoBloom?: boolean;
      immersedBloom?: boolean;
      agitateBloom?: boolean;
      swirl?: boolean;
    };
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
    coffee.daysOffRoast != null ? `Days off roast: ${coffee.daysOffRoast}` : null,
    coffee.tastingNotes ? `Roaster notes: ${coffee.tastingNotes}` : null,
  ].filter(Boolean).join('\n');

  const historySection = brewHistory.length === 0
    ? 'No previous brews logged with this coffee yet.'
    : brewHistory.slice(0, 6).map((b, i) => {
        const ratio = b.waterAmount && b.coffeeDose
          ? `1:${(b.waterAmount / b.coffeeDose).toFixed(1)}`
          : '—';
        const flavor = [
          b.acidity   != null ? `acidity ${b.acidity}/5`     : null,
          b.sweetness != null ? `sweetness ${b.sweetness}/5` : null,
          b.clarity   != null ? `clarity ${b.clarity}/5`     : null,
          b.body      != null ? `body ${b.body}/5`           : null,
          b.juiciness != null ? `juiciness ${b.juiciness}/5` : null,
          b.finish    != null ? `finish ${b.finish}/5`       : null,
          b.astringency != null && b.astringency > 1 ? `astringency ${b.astringency}/5` : null,
          b.sourness    != null && b.sourness > 1    ? `sourness ${b.sourness}/5`       : null,
        ].filter(Boolean).join(', ');

        const technique = b.pourOverDetails ? [
          b.pourOverDetails.totalPours != null ? `${b.pourOverDetails.totalPours} pours` : null,
          b.pourOverDetails.bloomAmount ? `bloom ${b.pourOverDetails.bloomAmount}g/${b.pourOverDetails.bloomTime ?? '?'}min` : null,
          b.pourOverDetails.totalBrewTime ? `brew time ${b.pourOverDetails.totalBrewTime}min` : null,
          b.pourOverDetails.immersionTime ? `immersion ${b.pourOverDetails.immersionTime}min` : null,
          b.pourOverDetails.melodrip ? 'Melodrip' : null,
          b.pourOverDetails.samoBloom ? 'Samo Bloom' : null,
          b.pourOverDetails.immersedBloom ? 'Immersed Bloom' : null,
          b.pourOverDetails.agitateBloom ? 'Agitate Bloom' : null,
          b.pourOverDetails.swirl ? 'Swirl' : null,
          b.pourOverDetails.pourHeight ? `pour height: ${b.pourOverDetails.pourHeight}` : null,
          b.pourOverDetails.agitation ? `agitation: ${b.pourOverDetails.agitation}` : null,
        ].filter(Boolean).join(', ') : null;

        return [
          `${i + 1}. ${b.brewDate} — ${b.brewingDevice}`,
          `   Grind: ${b.grindSetting}${b.grindSize ? ` (${b.grindSize})` : ''}${b.rpmSpeed ? ` @ ${b.rpmSpeed}rpm` : ''} | ${b.coffeeDose}g : ${b.waterAmount}g (${ratio}) | ${b.waterTempF}°F${b.waterPPM ? ` | ${b.waterPPM}ppm` : ''}`,
          technique ? `   Technique: ${technique}` : null,
          b.brewScore != null ? `   Score: ${b.brewScore}/5` : null,
          b.perceivedExtraction ? `   Perceived extraction: ${b.perceivedExtraction}` : null,
          flavor ? `   Flavor: ${flavor}` : null,
          b.flavorNotes ? `   Notes: "${b.flavorNotes}"` : null,
          b.suggestedChange ? `   Self-diagnosis: "${b.suggestedChange}"` : null,
        ].filter(Boolean).join('\n');
      }).join('\n\n');

  return `COFFEE:
${coffeeLine}

BREWER'S INTENT: "${intent}"

PERSONAL BREW HISTORY WITH THIS COFFEE (${brewHistory.length} brew${brewHistory.length !== 1 ? 's' : ''}):
${historySection}

---

Respond with exactly this structure:

**What this coffee wants:**
Based on the processing method, origin, roast level, varietal, and days off roast — what does this specific coffee call for? What techniques will reveal its best characteristics vs. suppress its weaknesses? Be specific about which aspects of this coffee's profile should drive the approach.

**Given your intent:**
Directly address the stated intent. Which specific levers — grind, temp, agitation, bloom, ratio, pour technique, RPM — should be adjusted and in which direction? Reference a named technique or expert approach if it directly applies.

**Starting recipe:**
Device · Grind setting (+ RPM if Sculptor 078) · Dose:Water ratio · Temp · Bloom (amount + time + technique) · Pour structure · Target brew time

Keep the recipe tight and concrete — real numbers, not ranges unless genuinely necessary. Total response under 400 words.`;
}
