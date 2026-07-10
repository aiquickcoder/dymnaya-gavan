from playwright.sync_api import sync_playwright
D="file:///Users/maksimpozdnysev/Downloads/mixMaster/pitch/deck.html"
O="/Users/maksimpozdnysev/Downloads/mixMaster/pitch/shots"
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome", headless=True)
    pg=b.new_page(viewport={"width":1280,"height":860})
    pg.goto(D, timeout=30000); pg.wait_for_timeout(1200)
    pg.screenshot(path=f"{O}/_v_hero.png")
    for label,name in [("Деньги утекают","_v_pain"),("Кто-то берёт 3","_v_anchor"),("Гости возвращаются","_v_axis2")]:
        try:
            pg.get_by_text(label, exact=False).first.scroll_into_view_if_needed(timeout=6000)
            pg.wait_for_timeout(450); pg.screenshot(path=f"{O}/{name}.png")
        except Exception as e:
            print("skip",name,repr(e))
    b.close(); print("verify ok")
