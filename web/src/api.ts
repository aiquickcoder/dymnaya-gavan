// Typed client for the mixMaster API. Unwraps the { data, error } envelope (R1.3).
import type {
  AnalyticsSummary,
  Call,
  CallType,
  OnboardingBrief,
  Component,
  Employee,
  EmployeeFull,
  Favourite,
  FeedbackView,
  GuestSummary,
  HomeConfig,
  LoginResponse,
  MenuRecipeView,
  Order,
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
  User,
  Visit,
  Zone,
} from "./types";
import { DEMO, demoApi } from "./lib/demo";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Admin CRM endpoints do not exist on the Go backend yet; the admin ships in
// demo mode. These stubs reject so a non-demo call fails loudly but compiles.
const notImpl = <T>(): Promise<T> => Promise.reject(new ApiError("not_impl", "нет в реальном API"));

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok || json.error) {
    const err = json.error ?? { code: "http_" + res.status, message: res.statusText };
    throw new ApiError(err.code, err.message);
  }
  return json.data as T;
}

const realApi = {
  // restaurants / employees
  createRestaurant: (name: string) =>
    request<Restaurant>("POST", "/restaurants", { name }),
  staffLogin: (code: string) =>
    request<LoginResponse>("POST", "/restaurants/employees", { code }),
  registerEmployee: (input: {
    firstName: string;
    lastName: string;
    middleName: string;
    shortName: string;
    position?: string;
    code: string;
  }) => request<RegisterEmployeeResponse>("POST", "/employees", input),
  employeesBatch: (ids: string[]) => request<Employee[]>("POST", "/employees/batch", { ids }),

  // shift — masters working today
  shift: (restaurantId: string) =>
    request<ShiftMaster[]>("GET", `/restaurants/${restaurantId}/shift`),
  setShift: (code: string, employeeIds: string[]) =>
    request<ShiftMaster[]>("POST", "/restaurants/shift", { code, employeeIds }),

  // menu — venue positions
  menuList: (restaurantId: string) =>
    request<MenuRecipeView[]>("POST", "/menu/list", { restaurantId }),
  recipeById: (id: string) => request<MenuRecipeView | null>("GET", `/recipes/${id}`),
  createMenu: (input: {
    restaurantId: string;
    authorEmployeeId: string;
    name: string;
    description: string;
    strength: number;
    price: number;
    rating?: number;
    badge?: string;
    tags: string[];
  }) => request<MenuRecipeView>("POST", "/menu", input),

  // recipes
  createRecipe: (input: {
    name?: string;
    strength: number;
    isSecret: boolean;
    components: Component[];
  }) => request<Recipe>("POST", "/recipes", input),
  recipesBatch: (ids: string[]) => request<Recipe[]>("POST", "/recipes/batch", { ids }),

  // orders
  openTable: (input: { restaurantId: string; tableId: string; userId?: string }) =>
    request<Order>("POST", "/orders/open", input),
  // NB: this endpoint returns a raw snake_case db.OrderRecipe, not a camelCase DTO.
  // The guest web never reads its body — it refreshes the order via openTable instead.
  attachRecipe: (orderId: string, input: { recipeId: string; employeeId: string }) =>
    request<unknown>("POST", `/orders/${orderId}/recipes`, input),
  removeRecipe: (orderId: string, orderRecipeId: string) =>
    request<void>("DELETE", `/orders/${orderId}/recipes/${orderRecipeId}`),
  closeOrder: (orderId: string) => request<Order>("POST", `/orders/${orderId}/close`),

  // order-recipe feedback (guest rates / reviews a prepared mix)
  rateRecipe: (orderRecipeId: string, input: { userId: string; score: number }) =>
    request<FeedbackView>("POST", `/order-recipes/${orderRecipeId}/rating`, input),
  reviewRecipe: (orderRecipeId: string, input: { userId: string; review: string }) =>
    request<FeedbackView>("POST", `/order-recipes/${orderRecipeId}/review`, input),

  // employee ratings (guest rates the master)
  rateEmployee: (employeeId: string, input: { userId: string; score: number }) =>
    request<RatingAgg>("POST", `/employees/${employeeId}/ratings`, input),
  employeeRating: (employeeId: string) =>
    request<RatingAgg>("GET", `/employees/${employeeId}/rating`),
  employeeRecipeFeedback: (id: string) =>
    request<RecipeFeedbackItem[]>("GET", `/employees/${id}/recipe-feedback`),

  // users / favourites
  registerUser: (input: { phoneNumber: string; gender?: string }) =>
    request<User>("POST", "/users", input),
  getUser: (id: string) => request<User>("GET", `/users/${id}`),
  listFavourites: (userId: string) => request<Favourite[]>("GET", `/users/${userId}/favourites`),
  addFavourite: (userId: string, orderRecipeId: string) =>
    request<void>("POST", `/users/${userId}/favourites`, { orderRecipeId }),
  removeFavourite: (userId: string, orderRecipeId: string) =>
    request<void>("DELETE", `/users/${userId}/favourites/${orderRecipeId}`),

  // ===== Wave 4: tables / zones ("Карта зала") — wired to the real backend =====
  // Config + live status (occupancy derived from the open order). Routes are flat
  // under /tables (POST-with-body for the restaurant-scoped lists) so they don't
  // collide with the /restaurants subtree.
  adminTables: (restaurantId: string): Promise<TableView[]> =>
    request<TableView[]>("POST", "/tables/list", { restaurantId }),
  // Upsert mirrors adminUpsertMenu: edit (has id) → partial PATCH /tables/{id};
  // create (no id) → POST /tables carrying the whole DTO (restaurantId in body).
  adminUpsertTable: (t: Partial<TableView> & { restaurantId: string }): Promise<TableView> =>
    t.id
      ? request<TableView>("PATCH", `/tables/${t.id}`, t)
      : request<TableView>("POST", "/tables", t),
  adminMoveTable: (id: string, x: number, y: number): Promise<void> =>
    request<void>("POST", `/tables/${id}/move`, { x, y }),
  adminDeleteTable: (id: string): Promise<void> =>
    request<void>("DELETE", `/tables/${id}`),
  adminZones: (restaurantId: string): Promise<Zone[]> =>
    request<Zone[]>("POST", "/tables/zones", { restaurantId }),
  adminTableAddMix: (tableId: string, menuId: string, employeeId: string): Promise<void> =>
    request<void>("POST", `/tables/${tableId}/mix`, { menuId, employeeId }),
  adminTableAddCustomMix: (
    tableId: string,
    name: string,
    employeeId: string,
    components: Component[],
    comment: string,
  ): Promise<void> =>
    request<void>("POST", `/tables/${tableId}/custom-mix`, { name, employeeId, components, comment }),
  adminCloseTable: (tableId: string): Promise<void> =>
    request<void>("POST", `/tables/${tableId}/close`),
  adminTableStates: (restaurantId: string): Promise<TableState[]> =>
    request<TableState[]>("POST", "/tables/states", { restaurantId }),

  // home builder (demo-only for now)
  homeConfig: (_restaurantId: string): Promise<HomeConfig> => notImpl(),
  adminSetHomeConfig: (_restaurantId: string, _c: HomeConfig): Promise<HomeConfig> => notImpl(),

  adminMenu: (restaurantId: string): Promise<MenuRecipeView[]> =>
    request<MenuRecipeView[]>("POST", "/menu/list-admin", { restaurantId }),
  adminUpsertMenu: (m: Partial<MenuRecipeView> & { restaurantId: string }): Promise<MenuRecipeView> =>
    m.id
      ? request<MenuRecipeView>("PATCH", `/menu/${m.id}`, m)
      : request<MenuRecipeView>("POST", "/menu", m),
  adminDeleteMenu: (id: string): Promise<void> => request<void>("DELETE", `/menu/${id}`),
  adminReorderMenu: (ids: string[]): Promise<void> =>
    request<void>("POST", "/menu/reorder", { ids }),

  // ===== Wave 2: employees / schedule / guests — wired to the real backend =====
  // Employees: full per-restaurant roster (join employee_restaurants + rating agg
  // + today's shift). GET /restaurants/{id}/employees-full → EmployeeFull[].
  adminEmployees: (restaurantId: string): Promise<EmployeeFull[]> =>
    request<EmployeeFull[]>("GET", `/restaurants/${restaurantId}/employees-full`),
  // Tip link (Нетмонет). Envelope data is the url or null when unset.
  employeeTipUrl: (employeeId: string): Promise<string | null> =>
    request<string | null>("GET", `/employees/${employeeId}/tip-url`),
  // Upsert: edit (has id) → partial PATCH /employees/{id} (position + status land
  // in employee_restaurants; phone/photoSlug/tipUrl on employees). Create (no id) →
  // POST on the same collection the GET reads, carrying restaurantId in the path.
  // Body mirrors adminUpsertMenu: the whole DTO is sent; the backend picks fields.
  adminUpsertEmployee: (e: Partial<EmployeeFull> & { restaurantId: string }): Promise<EmployeeFull> =>
    e.id
      ? request<EmployeeFull>("PATCH", `/employees/${e.id}`, e)
      : request<EmployeeFull>("POST", `/restaurants/${e.restaurantId}/employees-full`, e),
  // Today's roster by restaurant id (by-rid counterpart of the by-code
  // POST /restaurants/shift; symmetric to GET /restaurants/{id}/shift).
  adminSetShift: (restaurantId: string, employeeIds: string[]): Promise<void> =>
    request<void>("POST", `/restaurants/${restaurantId}/shift`, { employeeIds }),
  // Shift schedule grid. from/to are inclusive YYYY-MM-DD (UTC) day keys.
  adminSchedule: (restaurantId: string, fromISO: string, toISO: string): Promise<ScheduleRow[]> =>
    request<ScheduleRow[]>(
      "GET",
      `/restaurants/${restaurantId}/schedule?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
    ),
  // Toggle one day: on=true inserts the employee_schedule row, false deletes it.
  // restaurantId isn't in the signature — the backend derives it from the
  // employee's restaurant link. date is a YYYY-MM-DD day key.
  adminSetScheduleDay: (employeeId: string, dateISO: string, on: boolean): Promise<void> =>
    request<void>("POST", `/employees/${employeeId}/schedule`, { date: dateISO, on }),

  // Guests: distinct users seen via orders, with aggregates. NB: order price is not
  // fixed on the order yet, so ltv/total are backend approximations (see blueprint
  // §Гости); real revenue is the analytics wave.
  adminGuests: (restaurantId: string): Promise<GuestSummary[]> =>
    request<GuestSummary[]>("GET", `/restaurants/${restaurantId}/guests`),
  // One guest = summary (GET /users/{id}/summary) + visit history
  // (GET /users/{id}/visits), fetched in parallel.
  adminGuest: async (id: string): Promise<{ summary: GuestSummary; visits: Visit[] }> => {
    const [summary, visits] = await Promise.all([
      request<GuestSummary>("GET", `/users/${id}/summary`),
      request<Visit[]>("GET", `/users/${id}/visits`),
    ]);
    return { summary, visits };
  },

  adminAnalytics: (_restaurantId: string, _days: number): Promise<AnalyticsSummary> => notImpl(),
  adminAnalyticsRange: (_restaurantId: string, _from: string, _to: string): Promise<AnalyticsSummary> => notImpl(),

  // ===== Wave 3: reservations ("Брони") — wired to the real backend =====
  // List a venue's bookings, optionally one day. date is a YYYY-MM-DD key (UTC).
  adminReservations: (restaurantId: string, date?: string): Promise<Reservation[]> =>
    request<Reservation[]>("POST", "/reservations/list", { restaurantId, date }),
  // Upsert mirrors adminUpsertMenu: edit (has id) → partial PATCH /reservations/{id};
  // create (no id) → POST /reservations carrying the whole DTO (restaurantId in body).
  adminUpsertReservation: (r: Partial<Reservation> & { restaurantId: string }): Promise<Reservation> =>
    r.id
      ? request<Reservation>("PATCH", `/reservations/${r.id}`, r)
      : request<Reservation>("POST", "/reservations", r),
  adminSetReservationStatus: (id: string, status: ReservationStatus): Promise<void> =>
    request<void>("POST", `/reservations/${id}/status`, { status }),
  adminDeleteReservation: (id: string): Promise<void> =>
    request<void>("DELETE", `/reservations/${id}`),
  // Guest self-booking → POST /reservations (backend supports create). Table is
  // assigned later by staff, so no tableId is sent.
  createReservation: (input: {
    restaurantId: string; userId?: string | null; guestName: string; phone: string;
    date: string; time: string; endTime?: string; guests: number; zone?: string | null; note?: string | null;
  }): Promise<Reservation> => request<Reservation>("POST", "/reservations", input),
  // TODO(api): нет реального роута /users/{id}/reservations — demo-only.
  myReservations: (_userId: string): Promise<Reservation[]> => notImpl<Reservation[]>(),

  // ===== Wave 3: calls ("Обращения") — wired to the real backend =====
  // Guest raises a call from the table; POST bodies carry restaurantId (no path id
  // for list/archive because there is no table-scoped resource yet).
  createCall: (input: { restaurantId: string; tableId: string; type: CallType }): Promise<Call> =>
    request<Call>("POST", "/calls", input),
  adminCalls: (restaurantId: string): Promise<Call[]> =>
    request<Call[]>("POST", "/calls/list", { restaurantId }),
  adminCallsArchive: (restaurantId: string): Promise<Call[]> =>
    request<Call[]>("POST", "/calls/archive", { restaurantId }),
  adminSetMixNote: (orderId: string, orderRecipeId: string, note: string): Promise<void> =>
    request<void>("PATCH", `/orders/${orderId}/recipes/${orderRecipeId}/note`, { note }),
  adminAckCall: (id: string): Promise<void> =>
    request<void>("POST", `/calls/${id}/ack`),
  adminDoneCall: (id: string): Promise<void> =>
    request<void>("POST", `/calls/${id}/done`),

  // kitchen-bar (guest food menu)
  foodMenu: (restaurantId: string): Promise<MenuRecipeView[]> =>
    request<MenuRecipeView[]>("POST", "/menu/list-food", { restaurantId }),

  // onboarding briefs inbox (filled setup forms)
  onboardingBriefs: (): Promise<OnboardingBrief[]> =>
    request<OnboardingBrief[]>("GET", "/onboarding"),
};

// In the GitHub Pages / demo build there is no backend — serve seeded mock data.
export const api = DEMO ? demoApi : realApi;
