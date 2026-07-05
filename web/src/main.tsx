import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { DEMO, DEMO_RID, DEMO_TABLE } from "./lib/demo";
import { KEYS } from "./store";
import "./styles.css";

// Demo build (GitHub Pages): seed a table + guest session up-front so the app
// lands straight on a populated menu without a QR scan or backend.
if (DEMO) {
  if (!localStorage.getItem(KEYS.table))
    localStorage.setItem(KEYS.table, JSON.stringify({ restaurantId: DEMO_RID, tableId: DEMO_TABLE }));
  if (!localStorage.getItem(KEYS.guest))
    localStorage.setItem(KEYS.guest, JSON.stringify({ userId: "demo-user", phoneNumber: "+7 903 555-21-40" }));
  // Seed an admin session so /admin opens straight away without a manual login.
  if (!localStorage.getItem(KEYS.admin))
    localStorage.setItem(
      KEYS.admin,
      JSON.stringify({
        restaurantId: DEMO_RID,
        restaurantName: "Дымная Гавань",
        employeeId: "m-timur",
        employeeName: "Тимур",
        code: "DEMO0000",
      }),
    );
}

// Under GitHub Pages the app is served from /<repo>/, so route relative to BASE_URL.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
