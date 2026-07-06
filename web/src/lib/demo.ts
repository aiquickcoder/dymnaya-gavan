// Demo mode: when VITE_DEMO=1 (the GitHub Pages build), the app runs without a
// backend — `api` is swapped for this in-memory mock. Every method delegates to
// the mutable `demoStore` singleton (lib/demoStore.ts), so guest and admin share
// one source of truth: an admin edit is instantly visible on the guest web.
import type {
  CallType,
  Component,
  EmployeeFull,
  MenuRecipeView,
  Reservation,
  ReservationStatus,
  TableView,
} from "../types";
import { ANALYTICS_ANCHOR, DEMO_RID, DEMO_TABLE, demoStore } from "./demoStore";

export const DEMO = import.meta.env.VITE_DEMO === "1";
export { ANALYTICS_ANCHOR, DEMO_RID, DEMO_TABLE };

const ok = <T>(v: T): Promise<T> => Promise.resolve(v);

export const demoApi = {
  // ----- restaurants / employees -----
  createRestaurant: (name: string) => ok(demoStore.createRestaurant(name)),
  staffLogin: (code: string) => ok(demoStore.staffLogin(code)),
  registerEmployee: (input: { firstName: string; lastName: string; middleName: string; shortName: string; position?: string; code: string }) =>
    ok(demoStore.registerEmployee(input)),
  employeesBatch: (ids: string[]) => ok(demoStore.employeesBatch(ids)),

  // ----- shift -----
  shift: (rid: string) => ok(demoStore.shift(rid)),
  setShift: (code: string, employeeIds: string[]) => ok(demoStore.setShift(code, employeeIds)),

  // ----- menu -----
  menuList: (rid: string) => ok(demoStore.menuList(rid)),
  createMenu: (input: { restaurantId: string; authorEmployeeId: string; name: string; description: string; strength: number; price: number; rating?: number; badge?: string; tags: string[] }) =>
    ok(demoStore.createMenu(input)),

  // ----- recipes -----
  createRecipe: (input: { name?: string; strength: number; isSecret: boolean; components: Component[] }) => ok(demoStore.createRecipe(input)),
  recipesBatch: (ids: string[]) => ok(demoStore.recipesBatch(ids)),

  // ----- orders -----
  openTable: (input: { restaurantId: string; tableId: string; userId?: string }) => ok(demoStore.openTable(input)),
  attachRecipe: (orderId: string, input: { recipeId: string; employeeId: string }) => ok(demoStore.attachRecipe(orderId, input)),
  removeRecipe: (orderId: string, orderRecipeId: string) => ok(demoStore.removeRecipe(orderId, orderRecipeId)),
  closeOrder: (orderId: string) => ok(demoStore.closeOrder(orderId)),

  // ----- feedback / ratings -----
  rateRecipe: (orderRecipeId: string, input: { userId: string; score: number }) => ok(demoStore.rateRecipe(orderRecipeId, input)),
  reviewRecipe: (orderRecipeId: string, input: { userId: string; review: string }) => ok(demoStore.reviewRecipe(orderRecipeId, input)),
  rateEmployee: (employeeId: string, input: { userId: string; score: number }) => ok(demoStore.rateEmployee(employeeId, input)),
  employeeRating: (employeeId: string) => ok(demoStore.employeeRating(employeeId)),
  employeeRecipeFeedback: (id: string) => ok(demoStore.employeeRecipeFeedback(id)),

  // ----- users / favourites -----
  registerUser: (input: { phoneNumber: string; gender?: string }) => ok(demoStore.registerUser(input)),
  getUser: (id: string) => ok(demoStore.getUser(id)),
  listFavourites: (userId: string) => ok(demoStore.listFavourites(userId)),
  addFavourite: (userId: string, orderRecipeId: string) => ok(demoStore.addFavourite(userId, orderRecipeId)),
  removeFavourite: (userId: string, orderRecipeId: string) => ok(demoStore.removeFavourite(userId, orderRecipeId)),

  // ===== admin CRM =====
  adminTables: (restaurantId: string) => ok(demoStore.adminTables(restaurantId)),
  adminUpsertTable: (t: Partial<TableView> & { restaurantId: string }) => ok(demoStore.adminUpsertTable(t)),
  adminMoveTable: (id: string, x: number, y: number) => ok(demoStore.adminMoveTable(id, x, y)),
  adminDeleteTable: (id: string) => ok(demoStore.adminDeleteTable(id)),
  adminZones: (restaurantId: string) => ok(demoStore.adminZones(restaurantId)),
  adminTableAddMix: (tableId: string, menuId: string, employeeId: string) => ok(demoStore.adminTableAddMix(tableId, menuId, employeeId)),
  adminCloseTable: (tableId: string) => ok(demoStore.adminCloseTable(tableId)),

  adminMenu: (restaurantId: string) => ok(demoStore.adminMenu(restaurantId)),
  adminUpsertMenu: (m: Partial<MenuRecipeView> & { restaurantId: string }) => ok(demoStore.adminUpsertMenu(m)),
  adminDeleteMenu: (id: string) => ok(demoStore.adminDeleteMenu(id)),
  adminReorderMenu: (ids: string[]) => ok(demoStore.adminReorderMenu(ids)),

  adminEmployees: (restaurantId: string) => ok(demoStore.adminEmployees(restaurantId)),
  adminUpsertEmployee: (e: Partial<EmployeeFull> & { restaurantId: string }) => ok(demoStore.adminUpsertEmployee(e)),
  adminSetShift: (restaurantId: string, employeeIds: string[]) => ok(demoStore.adminSetShift(restaurantId, employeeIds)),

  adminGuests: (restaurantId: string) => ok(demoStore.adminGuests(restaurantId)),
  adminGuest: (id: string) => ok(demoStore.adminGuest(id)),

  adminAnalytics: (restaurantId: string, days: number) => ok(demoStore.adminAnalytics(restaurantId, days)),
  adminAnalyticsRange: (restaurantId: string, from: string, to: string) => ok(demoStore.adminAnalyticsRange(restaurantId, from, to)),

  // ----- reservations -----
  adminReservations: (restaurantId: string, date?: string) => ok(demoStore.adminReservations(restaurantId, date)),
  adminUpsertReservation: (r: Partial<Reservation> & { restaurantId: string }) => ok(demoStore.adminUpsertReservation(r)),
  adminSetReservationStatus: (id: string, status: ReservationStatus) => ok(demoStore.adminSetReservationStatus(id, status)),
  adminDeleteReservation: (id: string) => ok(demoStore.adminDeleteReservation(id)),

  // ----- calls -----
  createCall: (input: { restaurantId: string; tableId: string; type: CallType }) => ok(demoStore.createCall(input)),
  adminCalls: (restaurantId: string) => ok(demoStore.adminCalls(restaurantId)),
  adminAckCall: (id: string) => ok(demoStore.adminAckCall(id)),
  adminDoneCall: (id: string) => ok(demoStore.adminDoneCall(id)),

  // ----- kitchen-bar (guest food menu) -----
  foodMenu: (restaurantId: string) => ok(demoStore.foodMenu(restaurantId)),
};
