// TODO(api): these features have no backend endpoints yet. They are rendered
// from static mock data to stay faithful to the design; wire to real endpoints
// once the backend grows a tips domain, achievements, visit history, and a
// tobacco-stock list (see plan §"Известные пробелы дизайн↔API").

export interface Achievement {
  name: string;
  have: number;
  total: number;
  locked?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { name: "Дегустатор", have: 12, total: 20 },
  { name: "Коллекционер вкусов", have: 18, total: 40 },
  { name: "Постоянный гость", have: 5, total: 5 },
  { name: "Искатель секретов", have: 1, total: 3, locked: true },
];

export interface Visit {
  place: string;
  date: string;
  mix: string;
  master: string;
  score: number;
}

export const HISTORY: Visit[] = [
  { place: "Example lounge", date: "12 июн", mix: "Северное сияние", master: "Тимур", score: 5 },
  { place: "Example lounge", date: "5 июн", mix: "Цитрус Стронг", master: "Алина", score: 4 },
  { place: "Облако 9", date: "28 мая", mix: "Гранатовый дым", master: "Дин", score: 4 },
];

// Quick-feedback chips shown on the session screen (folded into the review text).
export const FEEDBACK_CHIPS = [
  "Быстро вынес",
  "Идеальный жар",
  "Ароматный дым",
  "Просил переделать",
  "Мастер красавчик",
];

// Tip presets (₽) for the tip screen — UI only, no payment backend.
export const TIP_PRESETS = [100, 200, 500];

// Venue identity. TODO(api): no guest-facing "get restaurant" endpoint — name
// and address are the app's own brand, table number comes from the QR deep-link.
export const VENUE = { name: "Example lounge", address: "ул. Камала, 4а" };

// TODO(api): no tobacco-stock endpoint — static list for the "в наличии" block.
export interface Tobacco {
  brand: string;
  note?: string;
}
export const TOBACCOS: Tobacco[] = [
  { brand: "Darkside", note: "забивка дня" },
  { brand: "MustHave" },
  { brand: "Element" },
  { brand: "Darkside × MOON", note: "мало" },
  { brand: "Northern" },
];
