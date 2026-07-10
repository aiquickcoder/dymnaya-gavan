// Mutable in-memory singleton backing the demo build. It is the SINGLE source of
// truth for both the guest web and the admin CRM: an edit made in /admin (menu,
// tables, staff, shift) is immediately visible in /guest because both read here.
//
// All methods are synchronous and return plain data; lib/demo.ts wraps them in
// Promises to satisfy the `api` shape. Seed data is deterministic (a small seeded
// PRNG) so charts/tables look identical across reloads.
import type {
  AnalyticsSummary,
  Call,
  CallStatus,
  CallType,
  Employee,
  EmployeeFull,
  Favourite,
  FeedbackView,
  GuestSummary,
  HomeConfig,
  HourLoad,
  LoginResponse,
  MenuRecipeView,
  Order,
  OrderRecipeView,
  RatingAgg,
  Recipe,
  RecipeFeedbackItem,
  RegisterEmployeeResponse,
  Reservation,
  ReservationStatus,
  Restaurant,
  ScheduleRow,
  ShiftMaster,
  TableState,
  TableView,
  TimePoint,
  TopItem,
  User,
  Visit,
  Zone,
} from "../types";

export const DEMO_RID = "demo-venue";
export const DEMO_TABLE = "4";

const NOW = "2026-07-04T18:00:00Z";
const DAY = 86400000;
const ANCHOR_MS = Date.UTC(2026, 6, 4); // fixed "today" so series stay stable

// ---------- deterministic helpers ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round1 = (n: number) => Math.round(n * 10) / 10;
let seq = 100;
const uid = (p: string) => `${p}-${(seq++).toString(36)}${Date.now().toString(36).slice(-4)}`;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const dowLabel = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;
};
const DOW = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Reservations/calls are seeded relative to the REAL current date (unlike the
// deterministic analytics anchor) so the /admin "сегодня" filter always finds
// today's bookings and "N мин назад" reads correctly. `new Date()` is fine here
// — this runs in the browser at import time.
const nowISO = () => new Date().toISOString();
const minsAgoISO = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const TODAY_YMD = nowISO().slice(0, 10);
const TOMORROW_YMD = new Date(Date.now() + DAY).toISOString().slice(0, 10);

// ---------- restaurant ----------
const restaurant: Restaurant = { id: DEMO_RID, name: "Example lounge", code: "DEMO0000" };

// ---------- employees ----------
let employees: EmployeeFull[] = [
  { id: "m-manu", firstName: "Ману", lastName: "", middleName: "", shortName: "Ману", position: "Главный", phone: "+7 903 555-10-00", photoSlug: "manu", tipUrl: "https://netmonet.co/p/manu", rating: 5.0, ratingCount: 214, onShift: true, status: "active" },
  { id: "m-timur", firstName: "Тимур", lastName: "Азизов", middleName: "Русланович", shortName: "Тимур", position: "Старший мастер", phone: "+7 903 555-10-01", photoSlug: "timur", tipUrl: "https://netmonet.co/p/timur", rating: 4.9, ratingCount: 128, onShift: true, status: "active" },
  { id: "m-alina", firstName: "Алина", lastName: "Ковалёва", middleName: "Игоревна", shortName: "Алина", position: "Кальянный мастер", phone: "+7 903 555-10-02", photoSlug: "alina", tipUrl: "https://netmonet.co/p/alina", rating: 4.6, ratingCount: 96, onShift: true, status: "active" },
  { id: "m-din", firstName: "Дин", lastName: "Соколов", middleName: "Артёмович", shortName: "Дин", position: "Стажёр", phone: "+7 903 555-10-03", photoSlug: "din", tipUrl: "https://netmonet.co/p/din", rating: 4.4, ratingCount: 41, onShift: true, status: "active" },
  { id: "m-vera", firstName: "Вера", lastName: "Лапина", middleName: "Сергеевна", shortName: "Вера", position: "Официант", phone: "+7 903 555-10-04", tipUrl: "https://netmonet.co/p/vera", rating: 4.7, ratingCount: 33, onShift: false, status: "active" },
  { id: "m-oleg", firstName: "Олег", lastName: "Гринёв", middleName: "Петрович", shortName: "Олег", position: "Менеджер", phone: "+7 903 555-10-05", rating: 0, ratingCount: 0, onShift: false, status: "inactive" },
];
const MASTER_IDS = ["m-manu", "m-timur", "m-alina", "m-din"];

// ---------- menu (кальянное меню: 3 раздела) ----------
// Разделы: «Авторские миксы» (карусель на главной), «Стандартный кальян», «Кальян
// на фрукте». Плитка «Секрет» ведёт на скрытую позицию secret-1 (не в каталоге).
type MenuSeed = {
  id: string; name: string; category: string; price: number; strength: number;
  master: string; rating: number; tags: string[]; description: string;
  comps?: [string, string, number][]; badge?: string | null;
};
const HOOKAH_SEED: MenuSeed[] = [
  // — Авторские миксы —
  { id: "auth-1", name: "Ореховый раф", category: "Авторские миксы", price: 2500, strength: 6, master: "m-timur", rating: 4.9, tags: ["Десертный", "Ореховый", "Сливочный"], description: "Густой сливочный десерт с нотами жареного ореха, мёда и ванили. Напоминает растопленный шоколадный батончик с ореховой пастой; лёгкая газировка в послевкусии добавляет игривости.", comps: [["BlackBurn", "Black Honey", 40], ["DarkSide", "Nutella", 30], ["BlackBurn", "Vanilla", 20], ["DarkSide", "CreamSoda", 10]] },
  { id: "auth-2", name: "Чёрный мускат", category: "Авторские миксы", price: 2500, strength: 8, master: "m-alina", rating: 4.8, tags: ["Терпкий", "Восточный", "Виноград"], description: "Терпкий глубокий виноград с восточными нотками муската и пан-рааса. Освежающая мята смягчает терпкость, а вишнёвая нотка добавляет благородную кислинку. Насыщенный и долгоиграющий вкус.", comps: [["Afzal", "Pan Raas", 35], ["DarkSide", "Grape", 35], ["BlackBurn", "Mint", 20], ["BlackBurn", "Dark Cherry", 10]] },
  { id: "auth-3", name: "Манго-ласси", category: "Авторские миксы", price: 2500, strength: 5, master: "m-timur", rating: 4.9, tags: ["Сладкий", "Манго", "Сливочный"], description: "Спелое сладкое манго в сливочном йогуртовом обрамлении — точь-в-точь индийский ласси. Ваниль и крем-сода делают вкус бархатистым, а лимонная кислинка освежает и не даёт засахариться.", comps: [["DarkSide", "Mango", 45], ["BlackBurn", "Vanilla", 25], ["DarkSide", "CreamSoda", 20], ["BlackBurn", "Lemon Fresh", 10]] },
  { id: "auth-4", name: "Клубничный мохито", category: "Авторские миксы", price: 2500, strength: 6, master: "m-din", rating: 4.8, tags: ["Ягодный", "Освежающий", "Мятный"], description: "Спелая клубника и лесные ягоды в компании с мятой и лаймом. Освежающий, слегка кисловатый коктейльный вкус с интенсивным холодком в горле — как летний мохито с ягодным топпингом.", comps: [["DarkSide", "Berry Blast", 40], ["BlackBurn", "Mint", 30], ["BlackBurn", "Lemon Fresh", 20], ["DarkSide", "Supernova", 10]] },
  // — Стандартный кальян —
  { id: "std-1", name: "Стандартный кальян", category: "Стандартный кальян", price: 2000, strength: 5, master: "m-timur", rating: 4.7, tags: ["Любой вкус"], description: "Любой табак на выбор, кроме Tangiers и Trofimoff's (парфюм-серия). Классический вкус и плотный дым." },
  { id: "std-2", name: "Крепкий кальян", category: "Стандартный кальян", price: 2500, strength: 9, master: "m-alina", rating: 4.6, tags: ["Крепкий"], description: "На табаке Tangiers или Trofimoff's (парфюм-серия). Для любителей плотного, крепкого удара." },
  { id: "std-3", name: "Лимитированная серия вкусов", category: "Стандартный кальян", price: 2500, strength: 6, master: "m-din", rating: 4.8, tags: ["Лимитка"], description: "Лимитированные вкусы от популярных брендов — уточняйте у мастера, какие в наличии сегодня." },
  // — Кальян на фрукте —
  { id: "fruit-1", name: "Ананасовый фреш", category: "Кальян на фрукте", price: 3500, strength: 7, master: "m-timur", rating: 4.9, tags: ["Тропический", "Кислый", "На фрукте"], description: "Сочный ананас с яркой лимонной кислинкой, охлаждённый ментоловым бризом; в послевкусии — лёгкая травянистая нота базилика. Кальян готовится на чаше из ананаса!", comps: [["BlackBurn", "Pineapple", 45], ["DarkSide", "Lemon Blast", 30], ["DarkSide", "Supernova", 15], ["BlackBurn", "Basilic", 10]] },
  { id: "fruit-2", name: "Зелёный сад", category: "Кальян на фрукте", price: 3000, strength: 8, master: "m-alina", rating: 4.8, tags: ["Яблочный", "Свежий", "На фрукте"], description: "Хрустящее зелёное яблоко с кисло-сладкой мякотью, пряный базилик и двойное охлаждение. Напоминает мохито с яблочным сиропом. Кальян готовится на чаше из яблока!", comps: [["BlackBurn", "Green Apple", 40], ["BlackBurn", "Basilic", 25], ["DarkSide", "Supernova", 20], ["DarkSide", "Mint", 15]] },
  // — Секрет (для плитки «Секрет»; в каталог не попадает) —
  { id: "secret-1", name: "Секретный вкус", category: "Секрет", price: 2500, strength: 6, master: "m-din", rating: 0, tags: ["Секрет", "Секрет", "Секрет"], badge: "?", description: "Заказ вслепую — доверьтесь мастеру. Он соберёт вкус под ваше настроение." },
];
let menu: MenuRecipeView[] = HOOKAH_SEED.map((s, i) => ({
  id: s.id,
  restaurantId: DEMO_RID,
  authorEmployeeId: s.master,
  name: s.name,
  description: s.description,
  strength: s.strength,
  price: s.price,
  rating: s.rating || null,
  badge: s.badge ?? null,
  tags: s.tags,
  createdAt: NOW,
  category: s.category,
  available: true,
  sortOrder: i,
  imageSlug: null,
  kind: "hookah",
  components: (s.comps ?? []).map(([brand, flavour, percent]) => ({ brand, flavour, percent })),
}));

// ---------- kitchen-bar menu (kind="kitchen") ----------
// Lives in the SAME `menu` array (single source of truth): adminMenu returns
// everything, guest menuList filters kitchen out, foodMenu keeps only kitchen.
interface KitchenSeed { id: string; name: string; category: string; price: number; description: string; badge?: string }
// section: "kitchen" (Кухня) | "bar" (Бар) — гость переключает вкладки в разделе «Меню».
const KITCHEN_SEEDS: (KitchenSeed & { section: "kitchen" | "bar" })[] = [
  // ---- Кухня ----
  { id: "food-1", section: "kitchen", name: "Хумус с питой", category: "Закуски", price: 650, description: "Нежный хумус из нута с оливковым маслом и тёплой питой." },
  { id: "food-2", section: "kitchen", name: "Сырная тарелка", category: "Закуски", price: 1200, description: "Ассорти сыров с мёдом, грецким орехом и виноградом.", badge: "Хит" },
  { id: "food-3", section: "kitchen", name: "Стейк Рибай", category: "Горячее", price: 2400, description: "Мраморная говядина средней прожарки с соусом чимичурри." },
  { id: "food-4", section: "kitchen", name: "Паста Карбонара", category: "Горячее", price: 890, description: "Сливочный соус, бекон, желток и пармезан." },
  { id: "food-7", section: "kitchen", name: "Чизкейк Нью-Йорк", category: "Десерты", price: 520, description: "Классический чизкейк с ягодным соусом.", badge: "MustHave" },
  { id: "food-8", section: "kitchen", name: "Тирамису", category: "Десерты", price: 540, description: "Итальянский десерт с маскарпоне и эспрессо." },
  // ---- Бар ----
  { id: "bar-1", section: "bar", name: "Домашний лимонад", category: "Лимонады", price: 450, description: "Освежающий лимонад с мятой и лаймом, 0.5 л." },
  { id: "bar-2", section: "bar", name: "Манго-маракуйя", category: "Лимонады", price: 490, description: "Тропический лимонад с пюре манго и маракуйи." },
  { id: "bar-3", section: "bar", name: "Клубника-базилик", category: "Лимонады", price: 490, description: "Ягодный лимонад со свежим базиликом и лаймом." },
  { id: "bar-4", section: "bar", name: "Чай масала", category: "Чай и кофе", price: 390, description: "Пряный индийский чай на молоке с кардамоном." },
  { id: "bar-5", section: "bar", name: "Марокканская мята", category: "Чай и кофе", price: 420, description: "Зелёный чай со свежей мятой и мёдом, чайник 0.6 л.", badge: "Хит" },
  { id: "bar-6", section: "bar", name: "Раф лавандовый", category: "Чай и кофе", price: 380, description: "Нежный сливочный кофе с лёгкой лавандой." },
  { id: "bar-7", section: "bar", name: "Мохито (0%)", category: "Коктейли", price: 520, description: "Безалкогольный: лайм, мята, тростниковый сироп, содовая." },
  { id: "bar-8", section: "bar", name: "Цитрусовый физз", category: "Коктейли", price: 540, description: "Апельсин, грейпфрут, тоник и веточка розмарина." },
  { id: "bar-9", section: "bar", name: "Пина колада (0%)", category: "Коктейли", price: 560, description: "Ананасовый сок, кокосовый крем и лёд. Без алкоголя." },
];
KITCHEN_SEEDS.forEach((k, i) => {
  menu.push({
    id: k.id, restaurantId: DEMO_RID, authorEmployeeId: "m-vera",
    name: k.name, description: k.description, strength: 0, price: k.price,
    rating: null, badge: k.badge ?? null, tags: [], createdAt: NOW,
    category: k.category, available: true, sortOrder: 100 + i,
    components: [], imageSlug: null, kind: "kitchen",
  });
});

// ---------- zones + tables ----------
let zones: Zone[] = [
  { id: "zone-main", name: "Основной зал" },
  { id: "zone-vip", name: "VIP" },
];

interface TableSeed {
  label: string;
  x: number;
  y: number;
  seats: number;
  shape: TableView["shape"];
  zone: string;
}
const TABLE_SEEDS: TableSeed[] = [
  { label: "1", x: 16, y: 18, seats: 4, shape: "round", zone: "zone-main" },
  { label: "2", x: 38, y: 18, seats: 4, shape: "square", zone: "zone-main" },
  { label: "3", x: 60, y: 18, seats: 2, shape: "round", zone: "zone-main" },
  { label: "4", x: 82, y: 20, seats: 6, shape: "rect", zone: "zone-main" },
  { label: "5", x: 16, y: 46, seats: 4, shape: "round", zone: "zone-main" },
  { label: "6", x: 38, y: 46, seats: 4, shape: "square", zone: "zone-main" },
  { label: "7", x: 60, y: 46, seats: 6, shape: "round", zone: "zone-main" },
  { label: "8", x: 82, y: 48, seats: 6, shape: "rect", zone: "zone-main" },
  { label: "9", x: 20, y: 78, seats: 6, shape: "round", zone: "zone-vip" },
  { label: "10", x: 44, y: 78, seats: 4, shape: "square", zone: "zone-vip" },
  { label: "11", x: 66, y: 78, seats: 8, shape: "round", zone: "zone-vip" },
  { label: "12", x: 86, y: 80, seats: 8, shape: "rect", zone: "zone-vip" },
];

const orders: Record<string, Order> = {};
const recipes: Record<string, Recipe> = {};

const toEmployee = (e: EmployeeFull): Employee => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, middleName: e.middleName, shortName: e.shortName, position: e.position });
const toShiftMaster = (e: EmployeeFull): ShiftMaster => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, middleName: e.middleName, shortName: e.shortName, position: e.position, rating: e.rating, ratingCount: e.ratingCount });
const empById = (id: string) => employees.find((e) => e.id === id);
const menuById = (id: string) => menu.find((m) => m.id === id);
const fullName = (e: EmployeeFull) => `${e.lastName} ${e.firstName} ${e.middleName}`.trim();

function orRecipe(orId: string, m: MenuRecipeView, master: EmployeeFull | undefined): OrderRecipeView {
  const secret = m.category === "Секретные" || /секрет/i.test(m.name);
  return {
    orderRecipeId: orId,
    recipeId: "r-" + m.id,
    recipeName: m.name,
    strength: m.strength,
    isSecret: secret,
    authorFullName: master ? fullName(master) : "Мастер смены",
    authorShortName: master ? master.shortName : "—",
    components: (m.components ?? []).map((c) => ({ ...c })),
  };
}

// Seed tables + the orders that occupy them.
interface OccSeed { menus: string[]; master: string; minutes: number; guests: number }
const OCCUPIED: Record<string, OccSeed> = {
  "3": { menus: ["auth-1"], master: "m-alina", minutes: 25, guests: 2 },
  "5": { menus: ["fruit-1", "auth-3"], master: "m-din", minutes: 58, guests: 4 },
  "10": { menus: ["std-2"], master: "m-timur", minutes: 12, guests: 2 },
  "12": { menus: ["auth-2", "fruit-2"], master: "m-alina", minutes: 74, guests: 5 },
};

let tables: TableView[] = TABLE_SEEDS.map((s) => {
  const base: TableView = {
    id: "t-" + s.label,
    restaurantId: DEMO_RID,
    label: s.label,
    x: s.x,
    y: s.y,
    seats: s.seats,
    shape: s.shape,
    zone: s.zone,
    status: "free",
    orderId: null,
    openedAt: null,
    minutes: null,
    total: null,
    guests: null,
  };
  // The canonical demo guest table (#7) carries the two seeded guest recipes.
  if (s.label === DEMO_TABLE) {
    const oid = "demo-order";
    orders[oid] = {
      id: oid,
      tableId: DEMO_TABLE,
      restaurantId: DEMO_RID,
      userId: "demo-user",
      createdAt: NOW,
      closedAt: null,
      recipes: [
        {
          orderRecipeId: "or-1",
          recipeId: "r-demo",
          recipeName: "Ананасовый бриз",
          strength: 5,
          isSecret: false,
          authorFullName: "Азизов Тимур Русланович",
          authorShortName: "Тимур",
          components: [
            { brand: "Darkside", flavour: "Falling Star", percent: 40 },
            { brand: "Tangiers", flavour: "Cane Mint", percent: 20 },
            { brand: "MustHave", flavour: "Pineapple Rings", percent: 40 },
          ],
          tags: ["Сладкий", "Тропический"],
        },
      ],
    };
    return { ...base, status: "occupied", orderId: oid, openedAt: NOW, minutes: 24, total: 1600, guests: 3 };
  }
  const occ = OCCUPIED[s.label];
  if (occ) {
    const oid = "ord-seed-" + s.label;
    const recs = occ.menus.map((mid, j) => orRecipe(`or-${s.label}-${j}`, menuById(mid)!, empById(occ.master)));
    orders[oid] = { id: oid, tableId: s.label, restaurantId: DEMO_RID, userId: null, createdAt: NOW, closedAt: null, recipes: recs };
    const total = occ.menus.reduce((sum, mid) => sum + (menuById(mid)?.price ?? 0), 0);
    return { ...base, status: "occupied", orderId: oid, openedAt: NOW, minutes: occ.minutes, total, guests: occ.guests };
  }
  return base;
});

// ---------- waiter per occupied table ----------
// The hookah master is derived from the order (recipe author); the waiter is a
// separate role. Occupied tables get a waiter assigned round-robin from the
// waiter pool (m-vera «Официант»). Kept in a side map so TableView is untouched.
const WAITER_IDS = ["m-vera"];
const tableWaiter: Record<string, string> = {};
let waiterCursor = 0;
tables.forEach((t) => {
  if (t.status === "occupied") tableWaiter[t.id] = WAITER_IDS[waiterCursor++ % WAITER_IDS.length];
});
function ensureWaiter(t: TableView): void {
  if (!tableWaiter[t.id]) tableWaiter[t.id] = WAITER_IDS[waiterCursor++ % WAITER_IDS.length];
}

// ---------- guests + visit history ----------
const GUEST_NAMES = ["Мария", "Иван", "Ольга", "Дмитрий", "Анна", "Сергей", "Екатерина", "Павел", "Наталья", "Артём", "Юлия", "Роман", "Виктория", "Никита", "Дарья", "Максим", "Полина", "Егор", "Алиса", "Кирилл"];
let guests: GuestSummary[] = [];
const guestVisits: Record<string, Visit[]> = {};

(function buildGuests() {
  const rng = mulberry32(0x51ee77);
  // Guests love mixes, not food — pick favourites/visits from hookah menu only.
  // (Kitchen items are appended after index 6, so this also keeps the seed's
  // deterministic output identical to before kitchen positions existed.)
  const hookahMenu = menu.filter((m) => m.kind !== "kitchen");
  for (let i = 0; i < 20; i++) {
    const anon = rng() < 0.18;
    const visits = 1 + Math.floor(rng() * 14);
    const avgScore = round1(3.8 + rng() * 1.2);
    const favouriteMix = hookahMenu[Math.floor(rng() * hookahMenu.length)].name;
    const createdMs = ANCHOR_MS - (Math.floor(rng() * 175) + 3) * DAY;
    const lastVisitMs = createdMs + Math.floor(rng() * Math.max(1, ANCHOR_MS - createdMs));
    const avgCheck = 1200 + Math.floor(rng() * 1200);
    const ltv = visits * avgCheck;
    const id = "g-" + (i + 1);
    const phone = `+7 9${pad(10 + Math.floor(rng() * 89))} ${pad(100 + Math.floor(rng() * 899), 3)}-${pad(Math.floor(rng() * 99))}-${pad(Math.floor(rng() * 99))}`;
    guests.push({ id, name: anon ? null : GUEST_NAMES[i], phoneNumber: phone, visits, lastVisit: new Date(lastVisitMs).toISOString(), favouriteMix, avgScore, ltv, createdAt: new Date(createdMs).toISOString() });

    const n = Math.min(visits, 6);
    const list: Visit[] = [];
    let ts = lastVisitMs;
    for (let k = 0; k < n; k++) {
      const two = rng() < 0.4;
      const m1 = hookahMenu[Math.floor(rng() * hookahMenu.length)];
      const mixes = two ? [m1.name, hookahMenu[Math.floor(rng() * hookahMenu.length)].name] : [m1.name];
      const master = empById(MASTER_IDS[Math.floor(rng() * MASTER_IDS.length)]);
      const total = mixes.reduce((sum, nm) => sum + (menu.find((x) => x.name === nm)?.price ?? 1300), 0);
      const score = rng() < 0.15 ? 3 : rng() < 0.5 ? 4 : 5;
      list.push({ orderId: `v-${id}-${k}`, date: new Date(ts).toISOString(), tableLabel: String(1 + Math.floor(rng() * 12)), mixes, master: master ? master.shortName : null, total, score });
      ts -= (2 + Math.floor(rng() * 20)) * DAY;
    }
    guestVisits[id] = list;
  }
})();

// LTV = the guest's actual spend, summed from their visit history (single source
// of truth: guestVisits). `ltv` is all-time; `ltvMonth` is the last 30 days
// relative to the demo "today" anchor (so it stays meaningful regardless of when
// the demo is viewed). Reads as «накурил на N».
const LTV_MONTH_FROM = ANCHOR_MS - 30 * DAY;
guests.forEach((g) => {
  const vs = guestVisits[g.id] ?? [];
  g.ltv = vs.reduce((s, v) => s + v.total, 0);
  g.ltvMonth = vs
    .filter((v) => Date.parse(v.date) >= LTV_MONTH_FROM)
    .reduce((s, v) => s + v.total, 0);
});

// ---------- feedback (guest reviews on a master's mixes) ----------
const feedbackByMaster: Record<string, RecipeFeedbackItem[]> = {
  "m-timur": [
    { orderRecipeId: "orf-t1", recipeId: "r-1", recipeName: "Северное сияние", strength: 5, score: 5, review: "Идеальный жар весь вечер, дым плотный и ароматный. Лучший мастер.", updatedAt: "2026-06-28T21:10:00Z", components: [{ brand: "Darkside", flavour: "Манго", percent: 40 }, { brand: "Darkside", flavour: "Маракуйя", percent: 35 }, { brand: "Element", flavour: "Лёд", percent: 25 }] },
    { orderRecipeId: "orf-t2", recipeId: "r-5", recipeName: "Тёмная сторона × MOON", strength: 6, score: 5, review: "Собрал под мой вкус, вышло насыщенно и небанально. Вернусь ещё.", updatedAt: "2026-06-24T20:35:00Z", components: [{ brand: "MustHave", flavour: "Виноград", percent: 45 }, { brand: "Element", flavour: "Черника", percent: 30 }, { brand: "Darkside", flavour: "Дыня", percent: 25 }] },
    { orderRecipeId: "orf-t3", recipeId: "r-3", recipeName: "Тропик Лайт", strength: 3, score: 4, review: "Лёгкий и приятный, для долгой посиделки самое то.", updatedAt: "2026-06-19T19:05:00Z", components: [{ brand: "Darkside", flavour: "Кокос", percent: 40 }, { brand: "MustHave", flavour: "Личи", percent: 35 }, { brand: "Darkside", flavour: "Манго", percent: 25 }] },
  ],
  "m-alina": [
    { orderRecipeId: "orf-a1", recipeId: "r-2", recipeName: "Гранатовый дым", strength: 7, score: 5, review: "Терпко и ярко, гранат читается отлично. Алина — огонь.", updatedAt: "2026-06-27T22:00:00Z", components: [{ brand: "MustHave", flavour: "Гранат", percent: 45 }, { brand: "Element", flavour: "Барбарис", percent: 30 }, { brand: "Darkside", flavour: "Мята", percent: 25 }] },
    { orderRecipeId: "orf-a2", recipeId: "r-7", recipeName: "Комбо со звездой", strength: 5, score: 5, review: "Промо-микс бомба, виноград с дыней заходят идеально.", updatedAt: "2026-06-22T21:40:00Z", components: [{ brand: "MustHave", flavour: "Виноград", percent: 40 }, { brand: "Darkside", flavour: "Дыня", percent: 35 }, { brand: "MustHave", flavour: "Личи", percent: 25 }] },
    { orderRecipeId: "orf-a3", recipeId: "r-4", recipeName: "Цитрус Стронг", strength: 9, score: 4, review: "Крепко и цитрусово, как я просила. Чуть бы мягче — но кайф.", updatedAt: "2026-06-15T20:15:00Z", components: [{ brand: "Darkside", flavour: "Лимон", percent: 40 }, { brand: "MustHave", flavour: "Грейпфрут", percent: 35 }, { brand: "Element", flavour: "Лёд", percent: 25 }] },
  ],
  "m-din": [
    { orderRecipeId: "orf-d1", recipeId: "r-6", recipeName: "Секретный вкус", strength: 6, score: 5, review: "Взял вслепую и не пожалел — Дин угадал настроение.", updatedAt: "2026-06-26T23:20:00Z", components: [{ brand: "MustHave", flavour: "Виноград", percent: 45 }, { brand: "Element", flavour: "Черника", percent: 30 }, { brand: "Darkside", flavour: "Дыня", percent: 25 }] },
    { orderRecipeId: "orf-d2", recipeId: "r-3", recipeName: "Тропик Лайт", strength: 3, score: 4, review: "Для стажёра очень достойно, вкус собран аккуратно.", updatedAt: "2026-06-18T19:50:00Z", components: [{ brand: "Darkside", flavour: "Кокос", percent: 40 }, { brand: "MustHave", flavour: "Личи", percent: 35 }, { brand: "Darkside", flavour: "Манго", percent: 25 }] },
  ],
};

// ---------- favourites + user ----------
const favourites: Favourite[] = [
  { orderRecipeId: "fav-fruit-1", recipeId: "fruit-1", recipeName: "Ананасовый фреш", strength: 7, isSecret: false, restaurantId: DEMO_RID, restaurantName: "Example lounge", authorFullName: "Азизов Тимур Русланович", authorShortName: "Тимур", components: [{ brand: "BlackBurn", flavour: "Pineapple", percent: 45 }, { brand: "DarkSide", flavour: "Lemon Blast", percent: 30 }, { brand: "DarkSide", flavour: "Supernova", percent: 15 }, { brand: "BlackBurn", flavour: "Basilic", percent: 10 }], myScore: 5, myReview: "Освежает идеально", likedAt: NOW },
];
const demoUser: User = { id: "demo-user", phoneNumber: "+7 903 555-21-40", gender: null, createdAt: NOW };

// ---------- order helpers ----------
const cloneOrder = (o: Order): Order => ({ ...o, recipes: o.recipes.slice() });
const openOrderForLabel = (label: string) => Object.values(orders).find((o) => o.tableId === label && !o.closedAt);
const tableByLabel = (label: string) => tables.find((t) => t.label === label);
const tableById = (id: string) => tables.find((t) => t.id === id);
// Resolve a table by either its id ("t-7") or label ("7"). Reservations forms
// pass ids (adminTables); guests pass whatever KEYS.table holds (the label).
const resolveTable = (idOrLabel?: string | null): TableView | undefined =>
  idOrLabel ? tableById(idOrLabel) ?? tableByLabel(idOrLabel) : undefined;

// Add hours to an "HH:MM" clock string (wraps at 24h). Used for reservation end times.
const addHoursHHMM = (hhmm: string, hours: number): string => {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10) || 0);
  const total = ((h * 60 + m + hours * 60) % 1440 + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

// Ensure `t` has an open order (seating it if needed) and return that order.
// Shared by admin "add mix" flows so occupied-state bookkeeping stays in one place.
function ensureOpenOrder(t: TableView): Order {
  let o = t.orderId ? orders[t.orderId] : undefined;
  if (!o || o.closedAt) {
    o = { id: uid("ord"), tableId: t.label, restaurantId: t.restaurantId, userId: null, createdAt: NOW, closedAt: null, recipes: [] };
    orders[o.id] = o;
    t.orderId = o.id;
    t.status = "occupied";
    t.openedAt = NOW;
    t.minutes = t.minutes ?? 0;
    t.guests = t.guests ?? 2;
    t.total = t.total ?? 0;
    ensureWaiter(t);
  }
  return o;
}

// ---------- reservations ("Брони") ----------
interface ResSeed { guest: string; phone: string; day: 0 | 1; time: string; tableLabel: string | null; guests: number; status: ReservationStatus; note?: string; userId?: string }
const RES_SEEDS: ResSeed[] = [
  // Брони демо-гостя (видны в «Мои брони» его профиля).
  { guest: "Вы", phone: "+7 999 000-00-00", day: 1, time: "20:00", tableLabel: "6", guests: 2, status: "confirmed", userId: "demo-user" },
  { guest: "Вы", phone: "+7 999 000-00-00", day: 1, time: "21:30", tableLabel: null, guests: 4, status: "new", note: "День рождения", userId: "demo-user" },
  { guest: "Мария Соколова", phone: "+7 903 210-45-11", day: 0, time: "18:00", tableLabel: "1", guests: 4, status: "confirmed" },
  { guest: "Иван Петров", phone: "+7 903 210-45-12", day: 0, time: "19:30", tableLabel: "4", guests: 6, status: "new", note: "Стол у окна" },
  { guest: "Ольга Кузнецова", phone: "+7 903 210-45-13", day: 0, time: "20:00", tableLabel: "9", guests: 6, status: "seated" },
  { guest: "Дмитрий Волков", phone: "+7 903 210-45-14", day: 0, time: "21:00", tableLabel: "11", guests: 8, status: "confirmed", note: "День рождения" },
  { guest: "Анна Морозова", phone: "+7 903 210-45-15", day: 0, time: "18:30", tableLabel: "2", guests: 3, status: "new" },
  { guest: "Сергей Новиков", phone: "+7 903 210-45-16", day: 0, time: "22:00", tableLabel: null, guests: 2, status: "cancelled" },
  { guest: "Екатерина Смирнова", phone: "+7 903 210-45-17", day: 1, time: "19:00", tableLabel: "7", guests: 6, status: "new" },
  { guest: "Павел Егоров", phone: "+7 903 210-45-18", day: 1, time: "20:30", tableLabel: "12", guests: 8, status: "confirmed" },
  { guest: "Наталья Орлова", phone: "+7 903 210-45-19", day: 1, time: "18:00", tableLabel: "5", guests: 4, status: "new" },
  { guest: "Артём Лебедев", phone: "+7 903 210-45-20", day: 1, time: "21:30", tableLabel: "10", guests: 4, status: "confirmed", note: "VIP-зал" },
];
let reservations: Reservation[] = RES_SEEDS.map((s, i) => {
  const t = s.tableLabel ? tableByLabel(s.tableLabel) : undefined;
  return {
    id: "res-" + (i + 1),
    restaurantId: DEMO_RID,
    userId: s.userId ?? null,
    guestName: s.guest,
    phone: s.phone,
    date: s.day === 0 ? TODAY_YMD : TOMORROW_YMD,
    time: s.time,
    endTime: addHoursHHMM(s.time, 2),
    tableId: t ? t.id : null,
    tableLabel: t ? t.label : null,
    guests: s.guests,
    zone: t ? t.zone : null,
    status: s.status,
    note: s.note ?? null,
    createdAt: nowISO(),
  };
});

// ---------- calls ("Обращения") ----------
// Active (new/ack) drive the "Состояние столов" view; done ones feed the archive.
// Tables t-5/t-10/t-12 are occupied, so their calls surface on the table cards.
const calls: Call[] = [
  { id: "call-1", restaurantId: DEMO_RID, tableId: "t-5", tableLabel: "5", type: "coals", status: "new", createdAt: minsAgoISO(2), ackedAt: null, doneAt: null },
  { id: "call-2", restaurantId: DEMO_RID, tableId: "t-12", tableLabel: "12", type: "waiter", status: "ack", createdAt: minsAgoISO(9), ackedAt: minsAgoISO(6), doneAt: null },
  { id: "call-3", restaurantId: DEMO_RID, tableId: "t-10", tableLabel: "10", type: "bill", status: "new", createdAt: minsAgoISO(1), ackedAt: null, doneAt: null },
  { id: "call-4", restaurantId: DEMO_RID, tableId: "t-3", tableLabel: "3", type: "master", status: "done", createdAt: minsAgoISO(25), ackedAt: minsAgoISO(22), doneAt: minsAgoISO(18) },
  { id: "call-5", restaurantId: DEMO_RID, tableId: "t-7", tableLabel: "7", type: "coals", status: "done", createdAt: minsAgoISO(48), ackedAt: minsAgoISO(45), doneAt: minsAgoISO(40) },
  { id: "call-6", restaurantId: DEMO_RID, tableId: "t-12", tableLabel: "12", type: "bill", status: "done", createdAt: minsAgoISO(72), ackedAt: minsAgoISO(66), doneAt: minsAgoISO(60) },
];
const callMatchesTable = (c: Call, t: TableView): boolean =>
  c.tableId === t.id || c.tableId === t.label || c.tableLabel === t.label;

// ---------- shift schedule ("График смен") ----------
// Per-date on/off shift flags, keyed `${employeeId}|${YYYY-MM-DD}`; mutable so the
// Staff schedule grid can toggle days and persist. Seeded from a per-employee
// weekday pattern (masters work different days) across a wide window around the
// real "today" so both the week- and month-view of the grid come up populated.
const scheduleMap: Record<string, boolean> = {};
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const scheduleKey = (employeeId: string, date: string) => `${employeeId}|${date}`;
// Weekday indices: 0=Вс 1=Пн 2=Вт 3=Ср 4=Чт 5=Пт 6=Сб.
const SHIFT_PATTERN: Record<string, number[]> = {
  "m-timur": [1, 3, 4, 5, 6], // Пн Ср Чт Пт Сб
  "m-alina": [2, 3, 5, 6, 0], // Вт Ср Пт Сб Вс
  "m-din": [1, 2, 4, 0], // Пн Вт Чт Вс
  "m-vera": [4, 5, 6, 0], // Чт Пт Сб Вс (официант)
  "m-oleg": [1, 2, 3, 4, 5], // Пн–Пт (менеджер)
};
(function seedSchedule() {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const mondayOffset = (now.getUTCDay() + 6) % 7; // days since this week's Monday
  const startMs = midnight - (mondayOffset + 14) * DAY; // 2 weeks before → 8 weeks total
  for (let d = 0; d < 56; d++) {
    const ms = startMs + d * DAY;
    const date = ymd(ms);
    const wd = new Date(ms).getUTCDay();
    employees.forEach((e) => {
      const pat = SHIFT_PATTERN[e.id];
      if (pat) scheduleMap[scheduleKey(e.id, date)] = pat.includes(wd);
    });
  }
})();

function freeTable(t: TableView) {
  t.status = "free";
  t.orderId = null;
  t.openedAt = null;
  t.minutes = null;
  t.total = null;
  t.guests = null;
}

function closeOrderInternal(orderId: string): Order | undefined {
  const o = orders[orderId];
  if (!o) return undefined;
  o.closedAt = NOW;
  const t = tables.find((x) => x.orderId === orderId) ?? tableByLabel(o.tableId);
  if (t) freeTable(t);
  return o;
}

// ---------- 90-day analytics series ----------
interface DayRow { date: string; revenue: number; orders: number; guests: number }
const DAILY: DayRow[] = (function build() {
  const rng = mulberry32(0x20260704);
  const rows: DayRow[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(ANCHOR_MS - i * DAY);
    const dow = d.getUTCDay();
    const weekend = dow === 5 || dow === 6 || dow === 0 ? 1.35 : 1;
    const trend = 1 + (89 - i) * 0.0025;
    const noise = 0.82 + rng() * 0.36;
    const orders = Math.round(26 * weekend * trend * noise);
    const avgCheck = 1300 + Math.round(rng() * 420);
    const revenue = orders * avgCheck;
    const guests = Math.round(orders * (1.6 + rng() * 0.6));
    rows.push({ date: d.toISOString(), revenue, orders, guests });
  }
  return rows;
})();

const HOUR_WEIGHTS = [0.5, 0.28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.4, 0.5, 0.5, 0.62, 0.72, 0.86, 1.0, 1.0, 0.95, 0.86, 0.7];
const SOLD_BASE: Record<string, number> = { "auth-1": 5.0, "auth-2": 4.6, "fruit-1": 4.2, "auth-3": 3.8, "auth-4": 3.5, "fruit-2": 3.2, "std-1": 3.0, "std-2": 2.6, "std-3": 2.4 };
const MASTER_SHARE: Record<string, number> = { "m-timur": 0.42, "m-alina": 0.36, "m-din": 0.22 };

function build(win: DayRow[], prev: DayRow[], spanDays: number, windowStartMs: number): AnalyticsSummary {
  const sum = (a: DayRow[], k: keyof DayRow) => a.reduce((s, r) => s + (r[k] as number), 0);

  const revenue = sum(win, "revenue");
  const ordersN = sum(win, "orders");
  const guestsN = sum(win, "guests");
  const prevRev = sum(prev, "revenue");
  const prevOrd = sum(prev, "orders");
  const revenueDelta = prevRev ? round1(((revenue - prevRev) / prevRev) * 100) : 0;
  const ordersDelta = prevOrd ? round1(((ordersN - prevOrd) / prevOrd) * 100) : 0;
  const avgCheck = ordersN ? Math.round(revenue / ordersN) : 0;

  const cap = Math.max(1, tables.length) * 6;
  const occupancy = `${Math.min(99, Math.round(ordersN / Math.max(1, win.length) / cap * 100))}%`;

  const ratedMasters = employees.filter((e) => MASTER_IDS.includes(e.id));
  const rc = ratedMasters.reduce((s, e) => s + e.ratingCount, 0);
  const avgRating = rc ? round1(ratedMasters.reduce((s, e) => s + e.rating * e.ratingCount, 0) / rc) : 0;

  const revenueSeries: TimePoint[] = win.map((r) => ({ label: dowLabel(r.date), value: r.revenue }));
  const ordersSeries: TimePoint[] = win.map((r) => ({ label: dowLabel(r.date), value: r.orders }));

  const dowAgg = [0, 0, 0, 0, 0, 0, 0];
  win.forEach((r) => { dowAgg[new Date(r.date).getUTCDay()] += r.revenue; });
  const byDow: TimePoint[] = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ label: DOW[i], value: dowAgg[i] }));

  const topMixes: TopItem[] = menu
    .filter((m) => m.kind !== "kitchen")
    .map((m) => ({ name: m.name, value: Math.round((SOLD_BASE[m.id] ?? 2.0) * spanDays) }))
    .sort((a, b) => b.value - a.value);

  const flAgg: Record<string, number> = {};
  topMixes.forEach((t) => {
    const m = menu.find((x) => x.name === t.name);
    m?.tags.forEach((tag) => {
      if (/секрет/i.test(tag)) return;
      flAgg[tag] = (flAgg[tag] ?? 0) + t.value / 3;
    });
  });
  const flavours: TopItem[] = Object.entries(flAgg)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const perDay = ordersN / Math.max(1, win.length);
  const hourLoad: HourLoad[] = HOUR_WEIGHTS.map((w, h) => ({ hour: h, value: Math.round(w * perDay * 1.1) }));

  const totalMixes = Math.round(ordersN * 1.6);
  const masters = ratedMasters.map((e) => ({ name: e.shortName, mixes: Math.round(totalMixes * (MASTER_SHARE[e.id] ?? 0.1)), rating: e.rating }));

  const gTotal = guests.length;
  const newC = guests.filter((g) => Date.parse(g.createdAt) >= windowStartMs).length;
  const returning = guests.filter((g) => g.visits > 1).length;
  const retention = gTotal ? Math.round((returning / gTotal) * 100) : 0;
  const avgLtv = gTotal ? Math.round(guests.reduce((s, g) => s + g.ltv, 0) / gTotal) : 0;

  // ----- «Оценки и отзывы» (deterministic) -----
  // Distribution 1..5 (emitted 5 → 1), skewed to 4–5, summing to the masters' total ratingCount.
  const DIST_PCT: [number, number][] = [[5, 0.6], [4, 0.26], [3, 0.08], [2, 0.04], [1, 0.02]];
  let distAcc = 0;
  const dist = DIST_PCT.map(([score, pct], i) => {
    const count = i === DIST_PCT.length - 1 ? Math.max(0, rc - distAcc) : Math.round(rc * pct);
    distAcc += count;
    return { score, count };
  });

  // Average-rating trend, one point per day in the window; gentle upward drift + seeded noise.
  const rTrendRng = mulberry32(0x9a71c3);
  const span = Math.max(1, win.length - 1);
  const trend: TimePoint[] = win.map((r, i) => {
    const base = 4.35 + (i / span) * 0.35;
    const noise = (rTrendRng() - 0.5) * 0.28;
    return { label: dowLabel(r.date), value: round1(Math.min(5, Math.max(3.8, base + noise))) };
  });

  // Latest reviews pulled from the seeded per-master feedback, newest first.
  const recent = Object.entries(feedbackByMaster)
    .flatMap(([mid, items]) => {
      const e = empById(mid);
      const author = e ? e.shortName : null;
      return items.map((it) => ({
        author,
        mix: it.recipeName ?? null,
        score: it.score ?? 5,
        review: it.review ?? null,
        date: it.updatedAt,
      }));
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 8);

  // Problem positions: lowest-rated available menu mixes (with an estimated sold count).
  const problem = menu
    .filter((m): m is MenuRecipeView & { rating: number } => typeof m.rating === "number")
    .map((m) => ({ mix: m.name, avg: m.rating, count: Math.round((SOLD_BASE[m.id] ?? 2.0) * spanDays) }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  return {
    days: spanDays,
    kpis: { revenue, orders: ordersN, avgCheck, guests: guestsN, occupancy, avgRating, revenueDelta, ordersDelta },
    revenue: revenueSeries,
    orders: ordersSeries,
    byDow,
    topMixes,
    flavours,
    hourLoad,
    masters,
    clients: { newC, returning, retention, avgLtv },
    ratings: { dist, trend, recent, problem },
  };
}

// Preset window: last N days ending at the anchor "today".
function analytics(days: number): AnalyticsSummary {
  const total = DAILY.length;
  const win = DAILY.slice(Math.max(0, total - days));
  const prev = DAILY.slice(Math.max(0, total - 2 * days), total - days);
  return build(win, prev, days, ANCHOR_MS - days * DAY);
}

// Arbitrary [from, to] date range (YYYY-MM-DD, inclusive).
function analyticsRange(from: string, to: string): AnalyticsSummary {
  const fromMs = Date.parse(from + "T00:00:00.000Z");
  const toMs = Date.parse(to + "T23:59:59.999Z");
  const win = DAILY.filter((r) => {
    const t = Date.parse(r.date);
    return t >= fromMs && t <= toMs;
  });
  const span = Math.max(1, win.length);
  const prevFromMs = fromMs - span * DAY;
  const prev = DAILY.filter((r) => {
    const t = Date.parse(r.date);
    return t >= prevFromMs && t < fromMs;
  });
  return build(win, prev, span, fromMs);
}

// The demo analytics "today" anchor (date portion), for period presets in the UI.
export const ANALYTICS_ANCHOR = new Date(ANCHOR_MS).toISOString().slice(0, 10);

// ----- home builder config (admin composes the guest home) -----
// Persisted to localStorage so admin edits survive a page reload in the demo.
const HOME_CFG_KEY = "mm.homeConfig";
const DEFAULT_HOME_CONFIG: HomeConfig = {
  blocks: [
    { key: "masters", label: "Мастера на смене", visible: true },
    { key: "banners", label: "Промо-баннеры", visible: true },
    { key: "quickActions", label: "Быстрый выбор", visible: true },
    { key: "session", label: "Сейчас вы курите", visible: true },
    { key: "bestMixes", label: "Лучшие миксы", visible: true },
    { key: "tobaccos", label: "Табаки в наличии", visible: true },
  ],
  bannerImage: null,
  bannerTag: "Уже можно попробовать",
};
function loadHomeConfig(): HomeConfig {
  try {
    const raw = localStorage.getItem(HOME_CFG_KEY);
    if (raw) {
      const p = JSON.parse(raw) as HomeConfig;
      if (Array.isArray(p.blocks) && p.blocks.length) return p;
    }
  } catch {
    /* ignore */
  }
  return { blocks: DEFAULT_HOME_CONFIG.blocks.map((b) => ({ ...b })), bannerImage: null, bannerTag: DEFAULT_HOME_CONFIG.bannerTag };
}
let homeConfig: HomeConfig = loadHomeConfig();

// ============================================================================
// Public singleton — every method is synchronous; lib/demo.ts wraps in Promises.
// ============================================================================
export const demoStore = {
  // ----- home builder -----
  getHomeConfig(): HomeConfig {
    return { blocks: homeConfig.blocks.map((b) => ({ ...b })), bannerImage: homeConfig.bannerImage ?? null, bannerTag: homeConfig.bannerTag ?? "" };
  },
  setHomeConfig(c: HomeConfig): HomeConfig {
    homeConfig = { blocks: c.blocks.map((b) => ({ ...b })), bannerImage: c.bannerImage ?? null, bannerTag: c.bannerTag ?? "" };
    try {
      localStorage.setItem(HOME_CFG_KEY, JSON.stringify(homeConfig));
    } catch {
      /* ignore quota / private mode */
    }
    return this.getHomeConfig();
  },

  // ----- guest / staff (existing api surface) -----
  createRestaurant(name: string): Restaurant {
    return { id: DEMO_RID, name, code: restaurant.code };
  },
  staffLogin(_code: string): LoginResponse {
    return { restaurant: { id: restaurant.id, name: restaurant.name }, employees: employees.map(toEmployee) };
  },
  registerEmployee(input: { firstName: string; lastName: string; middleName: string; shortName: string; position?: string }): RegisterEmployeeResponse {
    const e: EmployeeFull = { id: uid("emp"), firstName: input.firstName, lastName: input.lastName, middleName: input.middleName, shortName: input.shortName, position: input.position ?? "Сотрудник", phone: null, rating: 0, ratingCount: 0, onShift: false, status: "active" };
    employees.push(e);
    return { employee: toEmployee(e), restaurantId: DEMO_RID };
  },
  employeesBatch(ids: string[]): Employee[] {
    return employees.filter((e) => ids.includes(e.id)).map(toEmployee);
  },

  shift(_rid: string): ShiftMaster[] {
    return employees.filter((e) => e.onShift && e.status === "active").map(toShiftMaster);
  },
  setShift(_code: string, ids: string[]): ShiftMaster[] {
    employees.forEach((e) => { e.onShift = ids.includes(e.id); });
    return employees.filter((e) => e.onShift && e.status === "active").map(toShiftMaster);
  },

  menuList(_rid: string): MenuRecipeView[] {
    // Guest mix list: hookah only — kitchen positions have their own foodMenu.
    return menu.filter((m) => m.available !== false && m.kind !== "kitchen").slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
  createMenu(input: { restaurantId: string; authorEmployeeId: string; name: string; description: string; strength: number; price: number; rating?: number; badge?: string; tags: string[] }): MenuRecipeView {
    const item: MenuRecipeView = {
      id: uid("menu"),
      restaurantId: input.restaurantId,
      authorEmployeeId: input.authorEmployeeId,
      name: input.name,
      description: input.description,
      strength: input.strength,
      price: input.price,
      rating: input.rating ?? null,
      badge: input.badge ?? null,
      tags: input.tags,
      createdAt: NOW,
      category: "Прочее",
      available: true,
      sortOrder: menu.length,
      components: [],
      imageSlug: null,
      kind: "hookah",
    };
    menu.push(item);
    return item;
  },

  createRecipe(input: { name?: string; strength: number; isSecret: boolean; components: OrderRecipeView["components"] }): Recipe {
    const r: Recipe = { id: uid("r"), name: input.name ?? null, strength: input.strength, isSecret: input.isSecret, components: input.components };
    recipes[r.id] = r;
    return r;
  },
  recipesBatch(ids: string[]): Recipe[] {
    return ids.map((id) => recipes[id]).filter((r): r is Recipe => Boolean(r));
  },

  openTable(input: { restaurantId: string; tableId: string; userId?: string }): Order {
    const label = input.tableId;
    let o = openOrderForLabel(label);
    if (!o) {
      o = { id: uid("ord"), tableId: label, restaurantId: input.restaurantId, userId: input.userId ?? null, createdAt: NOW, closedAt: null, recipes: [] };
      orders[o.id] = o;
      const t = tableByLabel(label);
      if (t) { t.status = "occupied"; t.orderId = o.id; t.openedAt = NOW; if (t.guests == null) t.guests = 2; if (t.minutes == null) t.minutes = 0; if (t.total == null) t.total = 0; }
    }
    return cloneOrder(o);
  },
  attachRecipe(orderId: string, input: { recipeId: string; employeeId: string }): unknown {
    const o = orders[orderId];
    if (!o) return {};
    const rec = recipes[input.recipeId];
    const master = empById(input.employeeId);
    o.recipes.push({
      orderRecipeId: uid("or"),
      recipeId: input.recipeId,
      recipeName: rec?.name ?? null,
      strength: rec?.strength ?? null,
      isSecret: rec?.isSecret ?? false,
      authorFullName: master ? fullName(master) : "Мастер смены",
      authorShortName: master ? master.shortName : "—",
      components: (rec?.components ?? []).map((c) => ({ ...c })),
    });
    return {};
  },
  removeRecipe(orderId: string, orderRecipeId: string): void {
    const o = orders[orderId];
    if (o) o.recipes = o.recipes.filter((r) => r.orderRecipeId !== orderRecipeId);
  },
  closeOrder(orderId: string): Order {
    const o = closeOrderInternal(orderId);
    return o ? cloneOrder(o) : { id: orderId, tableId: "", restaurantId: DEMO_RID, userId: null, createdAt: NOW, closedAt: NOW, recipes: [] };
  },

  rateRecipe(orderRecipeId: string, i: { userId: string; score: number }): FeedbackView {
    return { orderRecipeId, score: i.score, review: null };
  },
  reviewRecipe(orderRecipeId: string, i: { userId: string; review: string }): FeedbackView {
    return { orderRecipeId, score: null, review: i.review };
  },
  rateEmployee(id: string, i: { userId: string; score: number }): RatingAgg {
    const e = empById(id);
    if (!e) return { average: i.score, count: 1 };
    const nextCount = e.ratingCount + 1;
    const nextAvg = round1((e.rating * e.ratingCount + i.score) / nextCount);
    e.rating = nextAvg;
    e.ratingCount = nextCount;
    return { average: nextAvg, count: nextCount };
  },
  employeeRating(id: string): RatingAgg {
    const e = empById(id);
    return e ? { average: e.rating, count: e.ratingCount } : { average: 0, count: 0 };
  },
  employeeRecipeFeedback(id: string): RecipeFeedbackItem[] {
    return feedbackByMaster[id] ?? [];
  },

  registerUser(i: { phoneNumber: string; gender?: string }): User {
    return { ...demoUser, phoneNumber: i.phoneNumber, gender: i.gender ?? null };
  },
  getUser(_id: string): User {
    return demoUser;
  },
  listFavourites(_userId: string): Favourite[] {
    return favourites.slice();
  },
  // Гость сохраняет позицию меню в избранное (демо: строим Favourite из микса).
  addFavourite(_userId: string, recipeId: string): void {
    if (favourites.some((f) => f.recipeId === recipeId)) return;
    const item = menu.find((m) => m.id === recipeId);
    if (!item) return;
    const emp = item.authorEmployeeId ? empById(item.authorEmployeeId) : undefined;
    favourites.unshift({
      orderRecipeId: `fav-${recipeId}`,
      recipeId,
      recipeName: item.name,
      strength: item.strength ?? null,
      isSecret: false,
      restaurantId: DEMO_RID,
      restaurantName: "Example lounge",
      authorFullName: emp ? `${emp.lastName} ${emp.firstName} ${emp.middleName}`.trim() : "",
      authorShortName: emp ? emp.shortName : "",
      components: item.components ?? [],
      myScore: null,
      myReview: null,
      likedAt: nowISO(),
    });
  },
  removeFavourite(_userId: string, orderRecipeId: string): void {
    const i = favourites.findIndex((f) => f.orderRecipeId === orderRecipeId || f.recipeId === orderRecipeId);
    if (i >= 0) favourites.splice(i, 1);
  },

  // ----- admin CRM -----
  adminTables(_rid: string): TableView[] {
    return tables.slice().sort((a, b) => (parseInt(a.label, 10) || 0) - (parseInt(b.label, 10) || 0)).map((t) => ({ ...t }));
  },
  adminUpsertTable(t: Partial<TableView> & { restaurantId: string }): TableView {
    if (t.id) {
      const ex = tableById(t.id);
      if (ex) {
        Object.assign(ex, t);
        return { ...ex };
      }
    }
    const created: TableView = {
      id: t.id ?? uid("t"),
      restaurantId: t.restaurantId,
      label: t.label ?? String(tables.length + 1),
      x: t.x ?? 50,
      y: t.y ?? 50,
      seats: t.seats ?? 4,
      shape: t.shape ?? "round",
      zone: t.zone ?? (zones[0]?.id ?? "zone-main"),
      status: t.status ?? "free",
      orderId: t.orderId ?? null,
      openedAt: t.openedAt ?? null,
      minutes: t.minutes ?? null,
      total: t.total ?? null,
      guests: t.guests ?? null,
    };
    tables.push(created);
    return { ...created };
  },
  adminMoveTable(id: string, x: number, y: number): void {
    const t = tableById(id);
    if (t) { t.x = x; t.y = y; }
  },
  adminDeleteTable(id: string): void {
    tables = tables.filter((t) => t.id !== id);
  },
  adminZones(_rid: string): Zone[] {
    return zones.slice();
  },
  adminTableAddMix(tableId: string, menuId: string, employeeId: string): void {
    const t = tableById(tableId);
    if (!t) return;
    const o = ensureOpenOrder(t);
    const m = menuById(menuId);
    if (m) {
      o.recipes.push(orRecipe(uid("or"), m, empById(employeeId)));
      t.total = (t.total ?? 0) + m.price;
    }
  },
  // Free-text mix — the master types a one-off name instead of picking from menu.
  adminTableAddCustomMix(tableId: string, name: string, employeeId: string): void {
    const t = tableById(tableId);
    if (!t) return;
    const o = ensureOpenOrder(t);
    const master = empById(employeeId);
    o.recipes.push({
      orderRecipeId: uid("or"),
      recipeId: uid("custom"),
      recipeName: name.trim() || "Свой микс",
      strength: null,
      isSecret: false,
      authorFullName: master ? fullName(master) : "Мастер смены",
      authorShortName: master ? master.shortName : "—",
      components: [],
    });
  },
  adminCloseTable(tableId: string): void {
    const t = tableById(tableId);
    if (!t) return;
    if (t.orderId) closeOrderInternal(t.orderId);
    freeTable(t);
  },
  // Live snapshot of ALL tables (occupied flag distinguishes them) with master,
  // waiter, mixes and active (new/ack) calls — backs the admin "Состояние столов"
  // view and the Dashboard "Активные столы" drill-in card.
  adminTableStates(_rid: string): TableState[] {
    return tables
      .slice()
      .sort((a, b) => (parseInt(a.label, 10) || 0) - (parseInt(b.label, 10) || 0))
      .map((t) => {
        const o = t.orderId ? orders[t.orderId] : undefined;
        const recs = o && !o.closedAt ? o.recipes : [];
        const mixes = recs.map((r) => ({ name: r.recipeName ?? "Микс", master: r.authorShortName ?? null }));
        const occupied = t.status === "occupied";
        const activeCalls = calls
          .filter((c) => c.status !== "done" && callMatchesTable(c, t))
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .map((c) => ({ ...c }));
        return {
          tableId: t.id,
          label: t.label,
          zone: t.zone,
          occupied,
          sinceISO: t.openedAt,
          minutes: t.minutes,
          guests: t.guests,
          masterName: recs[0]?.authorShortName ?? null,
          waiterName: occupied ? empById(tableWaiter[t.id] ?? WAITER_IDS[0])?.shortName ?? null : null,
          mixes,
          calls: activeCalls,
          total: t.total,
        };
      });
  },

  adminMenu(_rid: string): MenuRecipeView[] {
    return menu.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((m) => ({ ...m }));
  },
  adminUpsertMenu(m: Partial<MenuRecipeView> & { restaurantId: string }): MenuRecipeView {
    if (m.id) {
      const ex = menuById(m.id);
      if (ex) {
        Object.assign(ex, m);
        return { ...ex };
      }
    }
    const created: MenuRecipeView = {
      id: m.id ?? uid("menu"),
      restaurantId: m.restaurantId,
      authorEmployeeId: m.authorEmployeeId ?? MASTER_IDS[0],
      name: m.name ?? "Новый микс",
      description: m.description ?? "",
      strength: m.strength ?? 5,
      price: m.price ?? 1200,
      rating: m.rating ?? null,
      badge: m.badge ?? null,
      tags: m.tags ?? [],
      createdAt: NOW,
      category: m.category ?? "Прочее",
      available: m.available ?? true,
      sortOrder: m.sortOrder ?? menu.length,
      components: m.components ?? [],
      imageSlug: m.imageSlug ?? null,
      kind: m.kind ?? "hookah",
    };
    menu.push(created);
    return { ...created };
  },
  adminDeleteMenu(id: string): void {
    menu = menu.filter((m) => m.id !== id);
  },
  adminReorderMenu(ids: string[]): void {
    ids.forEach((id, i) => {
      const m = menuById(id);
      if (m) m.sortOrder = i;
    });
    menu.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },

  adminEmployees(_rid: string): EmployeeFull[] {
    return employees.map((e) => ({ ...e }));
  },
  employeeTipUrl(employeeId: string): string | null {
    return empById(employeeId)?.tipUrl ?? null;
  },
  adminUpsertEmployee(e: Partial<EmployeeFull> & { restaurantId: string }): EmployeeFull {
    if (e.id) {
      const ex = empById(e.id);
      if (ex) {
        const patch: Partial<EmployeeFull> = {
          firstName: e.firstName, lastName: e.lastName, middleName: e.middleName,
          shortName: e.shortName, position: e.position, phone: e.phone, photoSlug: e.photoSlug, tipUrl: e.tipUrl,
          rating: e.rating, ratingCount: e.ratingCount, onShift: e.onShift, status: e.status,
        };
        (Object.keys(patch) as (keyof EmployeeFull)[]).forEach((k) => {
          if (patch[k] === undefined) delete patch[k];
        });
        Object.assign(ex, patch);
        return { ...ex };
      }
    }
    const created: EmployeeFull = {
      id: e.id ?? uid("emp"),
      firstName: e.firstName ?? "",
      lastName: e.lastName ?? "",
      middleName: e.middleName ?? "",
      shortName: e.shortName ?? e.firstName ?? "Новый",
      position: e.position ?? "Сотрудник",
      phone: e.phone ?? null,
      photoSlug: e.photoSlug ?? null,
      tipUrl: e.tipUrl ?? null,
      rating: e.rating ?? 0,
      ratingCount: e.ratingCount ?? 0,
      onShift: e.onShift ?? false,
      status: e.status ?? "active",
    };
    employees.push(created);
    return { ...created };
  },
  adminSetShift(_rid: string, employeeIds: string[]): void {
    employees.forEach((e) => { e.onShift = employeeIds.includes(e.id); });
  },

  adminGuests(_rid: string): GuestSummary[] {
    return guests.map((g) => ({ ...g }));
  },
  adminGuest(id: string): { summary: GuestSummary; visits: Visit[] } {
    const summary = guests.find((g) => g.id === id) ?? guests[0];
    return { summary: { ...summary }, visits: (guestVisits[summary.id] ?? []).map((v) => ({ ...v })) };
  },

  adminAnalytics(_rid: string, days: number): AnalyticsSummary {
    return analytics(days);
  },
  adminAnalyticsRange(_rid: string, from: string, to: string): AnalyticsSummary {
    return analyticsRange(from, to);
  },

  // ----- reservations ("Брони") -----
  adminReservations(_rid: string, date?: string): Reservation[] {
    let list = reservations.slice();
    if (date) list = list.filter((r) => r.date === date);
    return list
      .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
      .map((r) => ({ ...r }));
  },
  adminUpsertReservation(r: Partial<Reservation> & { restaurantId: string }): Reservation {
    if (r.id) {
      const ex = reservations.find((x) => x.id === r.id);
      if (ex) {
        Object.assign(ex, r);
        const t = resolveTable(ex.tableId);
        if (t) { ex.tableId = t.id; ex.tableLabel = t.label; ex.zone = t.zone; }
        else { ex.tableId = null; ex.tableLabel = null; }
        return { ...ex };
      }
    }
    const t = resolveTable(r.tableId);
    const created: Reservation = {
      id: r.id ?? uid("res"),
      restaurantId: r.restaurantId,
      guestName: r.guestName ?? "Гость",
      phone: r.phone ?? "",
      date: r.date ?? TODAY_YMD,
      time: r.time ?? "20:00",
      endTime: r.endTime ?? addHoursHHMM(r.time ?? "20:00", 2),
      tableId: t ? t.id : null,
      tableLabel: t ? t.label : null,
      guests: r.guests ?? 2,
      zone: t ? t.zone : r.zone ?? null,
      status: r.status ?? "new",
      note: r.note ?? null,
      createdAt: nowISO(),
    };
    reservations.push(created);
    return { ...created };
  },
  adminSetReservationStatus(id: string, status: ReservationStatus): void {
    const r = reservations.find((x) => x.id === id);
    if (r) r.status = status;
  },
  adminDeleteReservation(id: string): void {
    reservations = reservations.filter((r) => r.id !== id);
  },
  // Гость создаёт заявку на бронь → падает в общий список (статус «Новая»), стол
  // назначает админ. Возвращает созданную бронь.
  createReservation(input: {
    restaurantId: string;
    userId?: string | null;
    guestName: string;
    phone: string;
    date: string;
    time: string;
    endTime?: string;
    guests: number;
    zone?: string | null;
    note?: string | null;
  }): Reservation {
    const created: Reservation = {
      id: uid("res"),
      restaurantId: input.restaurantId,
      userId: input.userId ?? null,
      guestName: input.guestName || "Гость",
      phone: input.phone ?? "",
      date: input.date,
      time: input.time,
      endTime: input.endTime ?? addHoursHHMM(input.time, 2),
      tableId: null,
      tableLabel: null,
      guests: input.guests ?? 2,
      zone: input.zone ?? null,
      status: "new",
      note: input.note ?? null,
      createdAt: nowISO(),
    };
    reservations.push(created);
    return { ...created };
  },
  // Брони конкретного гостя (по userId) для раздела «Мои брони» в профиле.
  myReservations(userId: string): Reservation[] {
    return reservations
      .filter((r) => r.userId === userId)
      .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
      .map((r) => ({ ...r }));
  },

  // ----- calls ("Обращения") -----
  createCall(input: { restaurantId: string; tableId: string; type: CallType }): Call {
    const t = resolveTable(input.tableId);
    const call: Call = {
      id: uid("call"),
      restaurantId: input.restaurantId,
      tableId: input.tableId,
      tableLabel: t ? t.label : input.tableId,
      type: input.type,
      status: "new",
      createdAt: nowISO(),
      ackedAt: null,
      doneAt: null,
    };
    calls.push(call);
    return { ...call };
  },
  adminCalls(_rid: string): Call[] {
    const rank: Record<CallStatus, number> = { new: 0, ack: 1, done: 2 };
    return calls
      .slice()
      .sort((a, b) => (rank[a.status] !== rank[b.status] ? rank[a.status] - rank[b.status] : Date.parse(b.createdAt) - Date.parse(a.createdAt)))
      .map((c) => ({ ...c }));
  },
  adminAckCall(id: string): void {
    const c = calls.find((x) => x.id === id);
    if (c && c.status === "new") { c.status = "ack"; c.ackedAt = nowISO(); }
  },
  adminDoneCall(id: string): void {
    const c = calls.find((x) => x.id === id);
    if (c && c.status !== "done") { c.status = "done"; c.doneAt = nowISO(); if (!c.ackedAt) c.ackedAt = nowISO(); }
  },
  // Archive tab: completed calls, most recently done first.
  adminCallsArchive(_rid: string): Call[] {
    return calls
      .filter((c) => c.status === "done")
      .slice()
      .sort((a, b) => Date.parse(b.doneAt ?? b.createdAt) - Date.parse(a.doneAt ?? a.createdAt))
      .map((c) => ({ ...c }));
  },

  // ----- shift schedule ("График смен") -----
  adminSchedule(_rid: string, fromISO: string, toISO: string): ScheduleRow[] {
    const from = fromISO.slice(0, 10);
    const to = toISO.slice(0, 10);
    const dates: string[] = [];
    let ms = Date.parse(from + "T00:00:00.000Z");
    const end = Date.parse(to + "T00:00:00.000Z");
    for (let guard = 0; ms <= end && guard < 400; ms += DAY, guard++) dates.push(ymd(ms));
    return employees.map((e) => {
      const days: Record<string, boolean> = {};
      dates.forEach((d) => { days[d] = scheduleMap[scheduleKey(e.id, d)] ?? false; });
      return { employeeId: e.id, shortName: e.shortName, position: e.position, days };
    });
  },
  adminSetScheduleDay(employeeId: string, dateISO: string, on: boolean): void {
    scheduleMap[scheduleKey(employeeId, dateISO.slice(0, 10))] = on;
  },

  // ----- kitchen-bar (guest food menu) -----
  foodMenu(_rid: string): MenuRecipeView[] {
    return menu
      .filter((m) => m.kind === "kitchen" && m.available !== false)
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((m) => ({ ...m }));
  },
};

export type DemoStore = typeof demoStore;
