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
}
