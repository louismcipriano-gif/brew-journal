export type ProcessingMethod =
  | 'Washed'
  | 'Honey'
  | 'Natural'
  | 'Washed Anaerobic'
  | 'Natural/Honey Anaerobic'
  | 'Thermal Shock'
  | 'Co-Ferment'
  | 'Hybrid/Other';

export type CoffeeStyle = 'Terroir-Focused' | 'Fruity' | 'Funky' | 'Experimental';

export type RoastLevel =
  | 'Ultra Light'
  | 'Light'
  | 'Light-Medium'
  | 'Medium'
  | 'Medium-Dark'
  | 'Dark';

export type BrewMethod =
  | 'Pour Over'
  | 'Espresso'
  | 'Immersion'
  | 'AeroPress'
  | 'Zuppa Longa';

export type PourHeightSpeed = 'Low' | 'Medium' | 'High' | 'Combination';

export type PerceivedExtraction = 'Under' | 'Balanced' | 'Over' | 'Uneven' | 'Unsure';

export interface Coffee {
  id: string;
  roaster: string;
  coffeeName?: string;
  producer?: string;
  farm?: string;
  countryOrigin: string;
  region: string;
  roastLevel: RoastLevel;
  processingMethod: string;
  roastDate: string;
  elevation: string;
  varietal: string;
  tastingNotes: string;
  price: number;
  gramsPerBag: number;
  score: number | null;
  coffeeStyle?: CoffeeStyle[];
  isResting?: boolean;
  isFinished?: boolean;
  isFreezing?: boolean;
  freezeStart?: string;
  freezeStop?: string;
  isFavorite?: boolean;
  createdAt: string;
}

export interface PourOverDetails {
  totalPours: number;
  bloomAmount: number;
  doubleBloom: boolean;
  melodrip: boolean;
  pourHeight: PourHeightSpeed;
  pourSpeed: PourHeightSpeed;
  pourStyle?: 'Circular' | 'Center' | 'Hybrid';
  agitation: PourHeightSpeed;
  bloomTime: number;
  totalBrewTime: number;
  pourSpeedMlS?: string;
  pourSpeedMaxMlS?: number;
  pourSpeedMinMlS?: number;
  varyingPourSpeed?: boolean;
}

export interface EspressoDetails {
  totalYield: number;
  brewTime: number;
  maxPressure: number;
}

export interface FlavorProfile {
  acidity: number;
  sweetness: number;
  body: number;
  florality: number;
  clarity: number;
  juiciness: number;
  finish: number;
  astringency: number;
  sourness: number;
  flavorNotes: string;
  perceivedExtraction: PerceivedExtraction;
  moreAcidity: boolean;
  moreSweetness: boolean;
  moreClarity: boolean;
  moreFlorality: boolean;
  moreBody: boolean;
  lessBitterness: boolean;
  lessAstringency: boolean;
  lessSourness: boolean;
  lessMuddled: boolean;
  suggestedChange: string;
}

export interface ApaxDrops {
  tonik?: number;
  jamm?: number;
  lylac?: number;
  april?: number;
  konflux?: number;
}

export interface Brew {
  id: string;
  coffeeId: string;
  brewDate: string;
  brewMethod: BrewMethod;
  grinder: string;
  grindSetting: number;
  grindSize?: string;
  brewingDevice: string;
  filter?: string;
  brewerShape?: 'Cone' | 'Flat';
  bypass?: 'Standard' | 'Low Bypass' | 'No Bypass';
  coffeeDose: number;
  waterAmount: number;
  waterTempF: number;
  waterPPM: number;
  waterRecipe: string;
  quickScore?: number;
  isQuickLog?: boolean;
  apaxDropsUsed?: boolean;
  apaxDrops?: ApaxDrops;
  brewRecipeName: string;
  brewRecipeDetails: string;
  pourOverDetails?: PourOverDetails;
  espressoDetails?: EspressoDetails;
  finalBrewWeight?: number;
  tds?: number;
  extractionYield?: number;
  flavorProfile: FlavorProfile;
  brewScore?: number;
  brewRatio?: number;
  bloomRatio?: number;
  // Coffee snapshot — denormalised at save time for analytics
  daysOffRoast?: number;
  coffeeProcessingMethod?: string;
  coffeeVarietal?: string;
  coffeeOrigin?: string;
  coffeeRegion?: string;
  coffeeElevation?: string;
  coffeeRoastLevel?: string;
  isDiluted?: boolean;
  dilutionAmount?: number;
  dilutionToCoffeeRatio?: number;    // dilutionAmount / coffeeDose
  dilutionToBrewWaterRatio?: number; // dilutionAmount / waterAmount
  isGoToRecipe: boolean;
  createdAt: string;
}

export type RecipeAccentuates = 'Sweetness' | 'Acidity' | 'Clarity' | 'Juiciness' | 'Texture' | 'Body' | 'Balance';

export interface GrinderEntry {
  grinder: string;
  settingRange: string;
}

export interface SavedRecipe {
  id: string;
  name: string;
  source: string;
  brewMethod: BrewMethod;
  brewingDevice: string;
  filter?: string;
  brewerShape?: 'Cone' | 'Flat';
  bypass?: 'Standard' | 'Low Bypass' | 'No Bypass';
  coffeeDose: number;
  waterAmount: number;
  waterTempF: number;
  waterPPM: number;
  waterRecipe: string;
  recipeDetails: string;
  accentuates?: RecipeAccentuates[];
  grindSize?: string;
  grinderEntries?: GrinderEntry[];
  isDiluted?: boolean;
  dilutionAmount?: number;
  pourOverDetails?: PourOverDetails;
  espressoDetails?: EspressoDetails;
  createdAt: string;
}

export type WaterProduct = 'Apax Labs' | 'Lotus Drops' | 'Third Wave Water';

export interface WaterRecipe {
  id: string;
  name: string;
  ppm?: number;
  gh?: number;
  kh?: number;
  ca?: number;
  mg?: number;
  na?: number;
  k?: number;
  apaxTonik?: number;
  apaxJamm?: number;
  apaxLylac?: number;
  apaxApril?: number;
  apaxKonflux?: number;
  productsUsed: WaterProduct[];
  notes: string;
  createdAt: string;
}

export interface AppData {
  coffees: Coffee[];
  brews: Brew[];
  recipes: SavedRecipe[];
  waterRecipes: WaterRecipe[];
}
