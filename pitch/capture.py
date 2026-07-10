#!/usr/bin/env python3
import os, time
from playwright.sync_api import sync_playwright

BASE = "https://aiquickcoder.github.io/dymnaya-gavan"
OUT  = "/Users/maksimpozdnysev/Downloads/mixMaster/pitch/shots"
os.makedirs(OUT, exist_ok=True)

GUEST_LS = """
localStorage.setItem('mm.table', JSON.stringify({restaurantId:'demo-venue',tableId:'4'}));
localStorage.setItem('mm.guest', JSON.stringify({userId:'demo-user',phoneNumber:'+79990000000',anon:false}));
localStorage.setItem('mm.theme', JSON.stringify('light'));
"""
ADMIN_LS = """
localStorage.setItem('mm.admin', JSON.stringify({restaurantId:'demo-venue',restaurantName:'Кальянное место',employeeId:'m-timur',employeeName:'Тимур',code:'DEMO0000'}));
localStorage.setItem('mm.theme', JSON.stringify('light'));
"""

def shot(page, path, wait_sel=None, scroll_to=None, settle=1400):
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass
    if wait_sel:
        try: page.wait_for_selector(wait_sel, timeout=12000)
        except Exception as e: print("  (no sel", wait_sel, ")")
    if scroll_to:
        try:
            page.get_by_text(scroll_to, exact=False).first.scroll_into_view_if_needed(timeout=6000)
        except Exception: print("  (no scroll target", scroll_to, ")")
    page.wait_for_timeout(settle)
    page.screenshot(path=path)
    print("  saved", os.path.basename(path), os.path.getsize(path)//1024, "KB")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)

    # ---------- GUEST (mobile) ----------
    g = browser.new_context(viewport={"width":404,"height":880}, device_scale_factor=2,
                            is_mobile=True, has_touch=True)
    g.add_init_script(GUEST_LS)
    pg = g.new_page()
    print("guest/home"); pg.goto(f"{BASE}/guest/home", timeout=45000); shot(pg, f"{OUT}/guest_home.png", wait_sel=".bm-carousel")
    print("guest/home -> menu"); shot(pg, f"{OUT}/guest_menu.png", scroll_to="Авторские миксы")
    print("guest/home -> catalog"); shot(pg, f"{OUT}/guest_catalog.png", scroll_to="Кальянное меню")
    print("guest/mix"); pg.goto(f"{BASE}/guest/mix/auth-1", timeout=45000); shot(pg, f"{OUT}/guest_mix.png", wait_sel=".hero")
    print("guest/book"); pg.goto(f"{BASE}/guest/book", timeout=45000); shot(pg, f"{OUT}/guest_book.png", wait_sel=".bk-slots")
    print("guest/profile"); pg.goto(f"{BASE}/guest/profile", timeout=45000); shot(pg, f"{OUT}/guest_profile.png", wait_sel=".pill")
    g.close()

    # ---------- ADMIN (desktop) ----------
    a = browser.new_context(viewport={"width":1440,"height":900}, device_scale_factor=2)
    a.add_init_script(ADMIN_LS)
    ap = a.new_page()
    for route, name, sel in [
        ("/admin/tables","admin_tables",None),
        ("/admin/clients","admin_clients",None),
        ("/admin/staff","admin_staff",None),
        ("/admin/reservations","admin_reservations",None),
        ("/admin","admin_dashboard",None),
        ("/admin/analytics","admin_analytics",None),
    ]:
        print("admin", route)
        try:
            ap.goto(f"{BASE}{route}", timeout=45000)
            shot(ap, f"{OUT}/{name}.png", wait_sel=sel, settle=1800)
        except Exception as e:
            print("  FAIL", name, repr(e))
    a.close()
    browser.close()
print("done")
