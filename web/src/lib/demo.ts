// Demo mode: when VITE_DEMO=1 (the GitHub Pages build), the app runs without a
// backend — `api` is swapped for this in-memory mock that mirrors the seeded venue.
import type {
  Employee,
  Favourite,
  FeedbackView,
  LoginResponse,
  MenuRecipeView,
  Order,
  OrderRecipeView,
  RatingAgg,
  Recipe,
  RegisterEmployeeResponse,
  Restaurant,
  ShiftMaster,
  User,
} from "../types";

export const DEMO = import.meta.env.VITE_DEMO === "1";

export const DEMO_RID = "demo-venue";
export const DEMO_TABLE = "7";

const now = "2026-07-01T18:00:00Z";

const MASTERS: ShiftMaster[] = [
  { id: "m-timur", firstName: "Тимур", lastName: "Азизов", middleName: "Русланович", shortName: "Тимур", position: "Старший мастер", rating: 4.9, ratingCount: 128 },
  { id: "m-alina", firstName: "Алина", lastName: "Ковалёва", middleName: "Игоревна", shortName: "Алина", position: "Кальянный мастер", rating: 4.6, ratingCount: 96 },
  { id: "m-din", firstName: "Дин", lastName: "Соколов", middleName: "Артёмович", shortName: "Дин", position: "Стажёр", rating: 4.4, ratingCount: 41 },
];

const MENU: MenuRecipeView[] = [
  { id: "menu-1", restaurantId: DEMO_RID, authorEmployeeId: "m-timur", name: "Северное сияние", description: "Свежо и тропически, с прохладным шлейфом.", strength: 5, price: 1200, rating: 4.8, badge: "Хит", tags: ["Манго", "Маракуйя", "Лёд"], createdAt: now },
  { id: "menu-2", restaurantId: DEMO_RID, authorEmployeeId: "m-alina", name: "Гранатовый дым", description: "Терпкий гранат с ягодной кислинкой.", strength: 7, price: 1200, rating: 4.6, badge: "MustHave", tags: ["Гранат", "Барбарис", "Мята"], createdAt: now },
  { id: "menu-3", restaurantId: DEMO_RID, authorEmployeeId: "m-timur", name: "Тропик Лайт", description: "Лёгкий, для долгого вечера.", strength: 3, price: 1100, rating: 4.7, badge: null, tags: ["Кокос", "Личи", "Манго"], createdAt: now },
  { id: "menu-4", restaurantId: DEMO_RID, authorEmployeeId: "m-alina", name: "Цитрус Стронг", description: "Мощный цитрус для любителей крепкого.", strength: 9, price: 1300, rating: 4.5, badge: null, tags: ["Лимон", "Грейпфрут", "Лёд"], createdAt: now },
  { id: "menu-5", restaurantId: DEMO_RID, authorEmployeeId: "m-timur", name: "Тёмная сторона × MOON", description: "Коллаборация месяца.", strength: 6, price: 1600, rating: 4.9, badge: "Limited", tags: ["Виноград", "Черника", "Дыня"], createdAt: now },
  { id: "menu-6", restaurantId: DEMO_RID, authorEmployeeId: "m-din", name: "Секретный вкус", description: "Заказ вслепую — доверьтесь мастеру.", strength: 6, price: 1400, rating: null, badge: "?", tags: ["Секрет", "Секрет", "Секрет"], createdAt: now },
];

const ORDER_RECIPES: OrderRecipeView[] = [
  {
    orderRecipeId: "or-1", recipeId: "r-1", recipeName: "Северное сияние", strength: 5, isSecret: false,
    authorFullName: "Азизов Тимур Русланович", authorShortName: "Тимур",
    components: [
      { brand: "Darkside", flavour: "Манго", percent: 40 },
      { brand: "Darkside", flavour: "Маракуйя", percent: 35 },
      { brand: "Element", flavour: "Лёд", percent: 25 },
    ],
  },
  {
    orderRecipeId: "or-2", recipeId: "r-2", recipeName: "Секретный вкус", strength: 6, isSecret: true,
    authorFullName: "Соколов Дин Артёмович", authorShortName: "Дин",
    components: [
      { brand: "MustHave", flavour: "Виноград", percent: 45 },
      { brand: "Element", flavour: "Черника", percent: 30 },
      { brand: "Darkside", flavour: "Дыня", percent: 25 },
    ],
  },
];

const ORDER: Order = {
  id: "demo-order", tableId: DEMO_TABLE, restaurantId: DEMO_RID, userId: "demo-user",
  createdAt: now, closedAt: null, recipes: ORDER_RECIPES,
};

const FAVOURITES: Favourite[] = [
  {
    orderRecipeId: "fav-1", recipeId: "r-1", recipeName: "Северное сияние", strength: 5, isSecret: false,
    restaurantId: DEMO_RID, restaurantName: "Дымная Гавань",
    authorFullName: "Азизов Тимур Русланович", authorShortName: "Тимур",
    components: [
      { brand: "Darkside", flavour: "Манго", percent: 40 },
      { brand: "Darkside", flavour: "Маракуйя", percent: 35 },
      { brand: "Element", flavour: "Лёд", percent: 25 },
    ],
    myScore: 5, myReview: "Идеальный жар, ароматный дым", likedAt: now,
  },
];

const DEMO_USER: User = { id: "demo-user", phoneNumber: "+7 900 000-00-00", gender: null, createdAt: now };
const ok = <T>(v: T) => Promise.resolve(v);

// Mirrors the shape of `api` in api.ts. Guest paths return seeded data; writes
// are accepted (no-op) so the flow completes; staff paths are minimal stubs.
export const demoApi = {
  createRestaurant: (name: string) => ok<Restaurant>({ id: DEMO_RID, name, code: "DEMO0000" }),
  staffLogin: (_code: string) => ok<LoginResponse>({ restaurant: { id: DEMO_RID, name: "Дымная Гавань" }, employees: MASTERS }),
  registerEmployee: (_i: unknown) => ok<RegisterEmployeeResponse>({ employee: MASTERS[0], restaurantId: DEMO_RID }),
  employeesBatch: (ids: string[]) => ok<Employee[]>(MASTERS.filter((m) => ids.includes(m.id))),

  shift: (_rid: string) => ok<ShiftMaster[]>(MASTERS),
  setShift: (_c: string, _ids: string[]) => ok<ShiftMaster[]>(MASTERS),

  menuList: (_rid: string) => ok<MenuRecipeView[]>(MENU),
  createMenu: (_i: unknown) => ok<MenuRecipeView>(MENU[0]),

  createRecipe: (i: { name?: string; strength: number; isSecret: boolean; components: OrderRecipeView["components"] }) =>
    ok<Recipe>({ id: "r-demo", name: i.name ?? null, strength: i.strength, isSecret: i.isSecret, components: i.components }),
  recipesBatch: (_ids: string[]) => ok<Recipe[]>([]),

  openTable: (_i: unknown) => ok<Order>(ORDER),
  attachRecipe: (_id: string, _i: unknown) => ok<unknown>({}),
  removeRecipe: (_id: string, _or: string) => ok<void>(undefined),
  closeOrder: (_id: string) => ok<Order>({ ...ORDER, recipes: [], closedAt: now }),

  rateRecipe: (orderRecipeId: string, i: { userId: string; score: number }) => ok<FeedbackView>({ orderRecipeId, score: i.score, review: null }),
  reviewRecipe: (orderRecipeId: string, i: { userId: string; review: string }) => ok<FeedbackView>({ orderRecipeId, score: null, review: i.review }),
  rateEmployee: (_id: string, i: { userId: string; score: number }) => ok<RatingAgg>({ average: i.score, count: 1 }),
  employeeRating: (_id: string) => ok<RatingAgg>({ average: 4.9, count: 128 }),

  registerUser: (i: { phoneNumber: string; gender?: string }) => ok<User>({ ...DEMO_USER, phoneNumber: i.phoneNumber, gender: i.gender ?? null }),
  getUser: (_id: string) => ok<User>(DEMO_USER),
  listFavourites: (_userId: string) => ok<Favourite[]>(FAVOURITES),
  addFavourite: (_u: string, _or: string) => ok<void>(undefined),
  removeFavourite: (_u: string, _or: string) => ok<void>(undefined),
};
