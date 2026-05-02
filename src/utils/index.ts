import type { FlavorProfile } from '../types';

export function calcBrewScore(fp: FlavorProfile): number {
  // Inputs on 1-5 scale. Output on 1-5 scale.
  const positiveAvg =
    (fp.acidity + fp.sweetness + fp.body + fp.florality + fp.clarity + fp.juiciness + fp.finish) / 7;
  const negativeAvg = (fp.astringency + fp.sourness) / 2;
  // positiveAvg 1-5 maps linearly to 1-5; negative subtracts up to 2 points
  const score = (positiveAvg - 1) + 1 - ((negativeAvg - 1) / 4) * 2;
  return Math.round(Math.max(1, Math.min(5, score)) * 10) / 10;
}

export function scoreColor(score: number): string {
  if (score >= 4.5) return '#b8920a';
  if (score >= 3.5) return '#2d6e4e';
  if (score >= 2.5) return '#b87d28';
  return '#9b3328';
}

export function scoreLabel(score: number): string {
  if (score >= 4.8) return 'Exceptional';
  if (score >= 4.2) return 'Excellent';
  if (score >= 3.7) return 'Very Good';
  if (score >= 3.2) return 'Good';
  if (score >= 2.5) return 'Average';
  if (score >= 2.0) return 'Below Average';
  return 'Poor';
}

export function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9 * 10) / 10;
}

function localDate(iso: string): Date {
  // Appending T00:00:00 forces JS to parse as local midnight, not UTC midnight,
  // which prevents the date from rolling back one day in US timezones.
  return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
}

export function daysOffRoast(roastDate: string, brewDate: string): number {
  const roast = localDate(roastDate).getTime();
  const brew = localDate(brewDate).getTime();
  return Math.floor((brew - roast) / (1000 * 60 * 60 * 24));
}

export function brewRatio(water: number, dose: number): string {
  if (!dose) return '—';
  return `1:${(water / dose).toFixed(1)}`;
}

export function bloomRatio(bloom: number, dose: number): string {
  if (!dose) return '—';
  return (bloom / dose).toFixed(1) + 'x';
}

export function espressoRatio(yield_: number, dose: number): string {
  if (!dose) return '—';
  return `1:${(yield_ / dose).toFixed(1)}`;
}

export function pricePerGram(price: number, grams: number): string {
  if (!grams) return '—';
  return '$' + (price / grams).toFixed(3);
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  return localDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function calcEY(tds: number, finalBrewWeight: number, coffeeDose: number): number | null {
  if (!tds || !finalBrewWeight || !coffeeDose) return null;
  return Math.round(((tds * finalBrewWeight) / coffeeDose) * 100) / 100;
}

export function uid(): string {
  return crypto.randomUUID();
}

export function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}
