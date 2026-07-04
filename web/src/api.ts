// Typed client for the mixMaster API. Unwraps the { data, error } envelope (R1.3).
import type {
  Component,
  Employee,
  Favourite,
  FeedbackView,
  LoginResponse,
  MenuRecipeView,
  Order,
  RatingAgg,
  Recipe,
  RegisterEmployeeResponse,
  Restaurant,
  ShiftMaster,
  User,
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

  // users / favourites
  registerUser: (input: { phoneNumber: string; gender?: string }) =>
    request<User>("POST", "/users", input),
  getUser: (id: string) => request<User>("GET", `/users/${id}`),
  listFavourites: (userId: string) => request<Favourite[]>("GET", `/users/${userId}/favourites`),
  addFavourite: (userId: string, orderRecipeId: string) =>
    request<void>("POST", `/users/${userId}/favourites`, { orderRecipeId }),
  removeFavourite: (userId: string, orderRecipeId: string) =>
    request<void>("DELETE", `/users/${userId}/favourites/${orderRecipeId}`),
};

// In the GitHub Pages / demo build there is no backend — serve seeded mock data.
export const api = DEMO ? demoApi : realApi;
