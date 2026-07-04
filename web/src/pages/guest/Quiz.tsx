import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell, BackHeader } from "../../components/Shell";
import MixCard from "../../components/MixCard";
import { useRequireTable } from "../../lib/guards";
import type { MenuRecipeView } from "../../types";

interface Step {
  key: string;
  q: string;
  opts: { v: string; l: string }[];
}
const STEPS: Step[] = [
  { key: "taste", q: "Какой вкус ближе?", opts: [{ v: "fresh", l: "Свежий" }, { v: "sweet", l: "Сладкий" }] },
  { key: "strength", q: "Насколько крепкий?", opts: [{ v: "light", l: "Лёгкий" }, { v: "strong", l: "Крепкий" }] },
  { key: "mood", q: "Настроение микса", opts: [{ v: "fruit", l: "Фруктовый" }, { v: "dessert", l: "Десертный" }, { v: "berry", l: "Ягодный" }] },
  { key: "ice", q: "Добавить лёд?", opts: [{ v: "yes", l: "Да" }, { v: "no", l: "Нет" }] },
];

const KEYWORDS: Record<string, string[]> = {
  fresh: ["мята", "лёд", "лед", "лимон", "грейпфрут", "цитрус"],
  sweet: ["манго", "дыня", "личи", "ваниль", "кокос"],
  fruit: ["манго", "маракуйя", "личи", "кокос", "дыня", "апельсин"],
  dessert: ["ваниль", "кокос", "кола"],
  berry: ["гранат", "виноград", "черника", "барбарис"],
};

function tagsHit(item: MenuRecipeView, keys: string[]): number {
  const tags = item.tags.map((t) => t.toLowerCase());
  return keys.reduce((n, k) => n + (tags.some((t) => t.includes(k)) ? 1 : 0), 0);
}

function pick(menu: MenuRecipeView[], a: Record<string, string>): MenuRecipeView | null {
  if (!menu.length) return null;
  let best: MenuRecipeView | null = null;
  let bestScore = -Infinity;
  for (const m of menu) {
    let s = 0;
    if (a.strength === "light") s += m.strength <= 5 ? 2 : -1;
    if (a.strength === "strong") s += m.strength >= 6 ? 2 : -1;
    if (a.taste) s += tagsHit(m, KEYWORDS[a.taste] ?? []);
    if (a.mood) s += tagsHit(m, KEYWORDS[a.mood] ?? []) * 1.5;
    if (a.ice === "yes") s += tagsHit(m, ["лёд", "лед"]) ? 1.5 : 0;
    s += (m.rating ?? 0) * 0.3; // популярность/рейтинг как тай-брейк
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

export default function Quiz() {
  const table = useRequireTable();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<MenuRecipeView[]>([]);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!table) return;
    api
      .menuList(table.restaurantId)
      .then(setMenu)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [table]);

  const done = step >= STEPS.length;
  const result = useMemo(() => (done ? pick(menu, answers) : null), [done, menu, answers]);

  function choose(v: string) {
    setAnswers((a) => ({ ...a, [STEPS[step].key]: v }));
    setStep((s) => s + 1);
  }
  function restart() {
    setAnswers({});
    setStep(0);
  }

  if (!table) return null;

  return (
    <Shell>
      <BackHeader title="AI-подбор" to="/guest/home" />
      {error && <Banner kind="error">{error}</Banner>}

      {!done ? (
        <div className="fade-in">
          <div className="dots">
            {STEPS.map((_, i) => (
              <span key={i} className={"dot" + (i <= step ? " on" : "")} />
            ))}
          </div>
          <h1 className="display center" style={{ fontSize: 26 }}>
            {STEPS[step].q}
          </h1>
          <div className="spacer lg" />
          {STEPS[step].opts.map((o) => (
            <button key={o.v} className="block lg" style={{ marginBottom: 10 }} onClick={() => choose(o.v)}>
              {o.l}
            </button>
          ))}
        </div>
      ) : (
        <div className="fade-in">
          <div className="section-title display center">AI подобрал вам микс</div>
          {result ? (
            <>
              <MixCard item={result} onClick={() => navigate(`/guest/mix/${result.id}`)} />
              <p className="muted small">
                Учли вашу крепость, вкусовые предпочтения и рейтинги гостей.
              </p>
              <button className="primary block lg" onClick={() => navigate(`/guest/mix/${result.id}`)}>
                Подробнее
              </button>
              <div style={{ height: 10 }} />
              <button className="ghost block" onClick={restart}>
                Пройти заново
              </button>
            </>
          ) : (
            <div className="empty">
              <div className="em-ico">○</div>
              <div>В меню пока нет позиций для подбора</div>
              <div style={{ height: 12 }} />
              <button className="ghost" onClick={restart}>
                Пройти заново
              </button>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
