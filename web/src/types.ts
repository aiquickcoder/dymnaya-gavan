// DTOs mirrored from the Go API (see docs/ARCHITECTURE.md §5).

export interface Component {
  brand: string;
  flavour: string;
  percent: number;
}

export interface Recipe {
  id: string;
  name?: string | null;
  strength?: number | null;
  isSecret: boolean;
  components: Component[];
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  shortName: string;
  position?: string | null;
}

export interface RestaurantBrief {
  id: string;
  name: string;
}

export interface Restaurant extends RestaurantBrief {
  code: string;
}

export interface LoginResponse {
  restaurant: RestaurantBrief;
  employees: Employee[];
}

export interface RegisterEmployeeResponse {
  employee: Employee;
  restaurantId: string;
}

// Master currently on shift, with aggregated rating (GET /restaurants/{id}/shift).
export interface ShiftMaster {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  shortName: string;
  position?: string | null;
  rating: number;
  ratingCount: number;
}

export interface RatingAgg {
  average: number;
  count: number;
}

// Upsert result from rating / review on an order-recipe.
export interface FeedbackView {
  orderRecipeId: string;
  score?: number | null;
  review?: string | null;
}

export interface OrderRecipeView {
  orderRecipeId: string;
  recipeId: string;
  recipeName?: string | null;
  strength?: number | null;
  isSecret: boolean;
  authorFullName: string;
  authorShortName: string;
  components: Component[];
}

export interface Order {
  id: string;
  tableId: string;
  restaurantId: string;
  userId?: string | null;
  createdAt: string;
  closedAt?: string | null;
  recipes: OrderRecipeView[];
}

export interface User {
  id: string;
  phoneNumber: string;
  gender?: string | null;
  createdAt: string;
}

export interface Favourite {
  orderRecipeId: string;
  recipeId: string;
  recipeName?: string | null;
  strength?: number | null;
  isSecret: boolean;
  restaurantId: string;
  restaurantName: string;
  authorFullName: string;
  authorShortName: string;
  components: Component[];
  myScore?: number | null;
  myReview?: string | null;
  likedAt: string;
}

// A single review a guest left on a mix prepared by this master
// (GET /employees/{id}/recipe-feedback).
export interface RecipeFeedbackItem {
  orderRecipeId: string;
  recipeId: string;
  recipeName?: string | null;
  strength?: number | null;
  score?: number | null;
  review?: string | null;
  updatedAt: string;
  components: Component[];
}

// A menu position of a venue (POST /menu/list). NB: menu has no per-component
// breakdown — only `tags` (3 flavour names) + free-text description.
export interface MenuRecipeView {
  id: string;
  restaurantId: string;
  authorEmployeeId: string;
  name: string;
  description: string;
  strength: number;
  price: number;
  rating?: number | null;
  badge?: string | null;
  tags: string[];
  createdAt: string;
  // Admin-only optional extensions (guest ignores them; kept nullable-safe).
  category?: string;
  available?: boolean;
  sortOrder?: number;
  components?: Component[];
  imageSlug?: string | null;
}

// ===== Admin CRM ("Дымная Гавань") view models =====
// All of the following are consumed by the /admin/* section pages via `api.admin*`.
// In the demo build they are backed by the mutable demoStore singleton.

export type TableStatus = "free" | "occupied";

export interface Zone {
  id: string;
  name: string;
}

export interface TableView {
  id: string;
  restaurantId: string;
  label: string;
  x: number; // 0..100 (% of floor canvas width)
  y: number; // 0..100 (% of floor canvas height)
  seats: number;
  shape: "round" | "square" | "rect";
  zone: string; // Zone.id
  status: TableStatus;
  orderId?: string | null;
  openedAt?: string | null;
  minutes?: number | null;
  total?: number | null;
  guests?: number | null;
}

export interface EmployeeFull {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  shortName: string;
  position: string;
  phone?: string | null;
  rating: number;
  ratingCount: number;
  onShift: boolean;
  status: "active" | "inactive";
}

export interface Visit {
  orderId: string;
  date: string;
  tableLabel?: string | null;
  mixes: string[];
  master?: string | null;
  total: number;
  score?: number | null;
}

export interface GuestSummary {
  id: string;
  name?: string | null;
  phoneNumber: string;
  visits: number;
  lastVisit?: string | null;
  favouriteMix?: string | null;
  avgScore?: number | null;
  ltv: number;
  createdAt: string;
}

export interface TimePoint {
  label: string;
  value: number;
}

export interface TopItem {
  name: string;
  value: number;
}

export interface HourLoad {
  hour: number;
  value: number;
}

export interface AnalyticsSummary {
  days: number;
  kpis: {
    revenue: number;
    orders: number;
    avgCheck: number;
    guests: number;
    occupancy: string;
    avgRating: number;
    revenueDelta?: number;
    ordersDelta?: number;
  };
  revenue: TimePoint[];
  orders: TimePoint[];
  byDow: TimePoint[];
  topMixes: TopItem[];
  flavours: TopItem[];
  hourLoad: HourLoad[];
  masters: { name: string; mixes: number; rating: number }[];
  clients: { newC: number; returning: number; retention: number; avgLtv: number };
  // Optional "Оценки и отзывы" block (admin analytics polish). Absent-safe:
  // consumers must treat `ratings` as possibly undefined.
  ratings?: {
    dist: { score: number; count: number }[]; // распределение 1..5 (порядок: 5 → 1)
    trend: TimePoint[]; // динамика среднего рейтинга по дням окна
    recent: { author?: string | null; mix?: string | null; score: number; review?: string | null; date: string }[];
    problem: { mix: string; avg: number; count: number }[]; // позиции с низким средним баллом
  };
}
