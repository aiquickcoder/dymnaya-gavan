import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell, BackHeader } from "../../components/Shell";
import MixCard from "../../components/MixCard";
import StarRating from "../../components/StarRating";
import CompositionBars from "../../components/CompositionBars";
import { useRequireTable } from "../../lib/guards";
import { masterImageUrl } from "../../lib/masterImages";
import type { MenuRecipeView, RatingAgg, RecipeFeedbackItem } from "../../types";

export default function Master() {
  const { id } = useParams();
  const table = useRequireTable();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const queryName = params.get("name") || "";
  const queryRole = params.get("role") || "";
  const [name, setName] = useState(queryName);
  const [role, setRole] = useState(queryRole);
  const [rating, setRating] = useState<RatingAgg | null>(null);
  const [reviews, setReviews] = useState<RecipeFeedbackItem[]>([]);
  const [mixes, setMixes] = useState<MenuRecipeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!table || !id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [ratingRes, feedbackRes, menu] = await Promise.all([
          api.employeeRating(id).catch(() => null),
          api.employeeRecipeFeedback(id).catch(() => [] as RecipeFeedbackItem[]),
          api.menuList(table.restaurantId),
        ]);
        if (!alive) return;
        setRating(ratingRes);
        setReviews(feedbackRes);
        setMixes(menu.filter((m) => m.authorEmployeeId === id));

        // Resolve the master's role (and name, when it was not passed through
        // the ?name query param) from the batch endpoint.
        const [emp] = await api.employeesBatch([id]).catch(() => []);
        if (alive && emp) {
          if (!queryName) setName(emp.shortName || emp.firstName);
          // position is null from the batch endpoint against the real backend;
          // fall back to the role passed via the query param.
          setRole(emp.position || queryRole);
        }
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [table, id, queryName, queryRole]);

  if (!table) return null;

  const displayName = name || "Мастер";
  const initial = displayName.trim().charAt(0).toUpperCase();
  const avatarUrl = masterImageUrl(displayName);
  const avg = rating?.average ?? 0;
  const count = rating?.count ?? 0;

  return (
    <Shell>
      <BackHeader title="Мастер" to="/guest/home" />
      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <div className="fade-in">
          <div className="skeleton" style={{ height: 108, width: 108, borderRadius: "50%", margin: "6px auto 14px" }} />
          <div className="skeleton" style={{ height: 60, marginBottom: 14 }} />
          <div className="skeleton skel-card" />
          <div className="skeleton skel-card" />
        </div>
      ) : (
        <div className="fade-in">
          <div className="mp-hero">
            <div
              className="mp-avatar"
              style={avatarUrl ? { backgroundImage: `url('${avatarUrl}')` } : undefined}
            >
              {!avatarUrl && initial}
            </div>
            <div className="mp-name">{displayName}</div>
            {role && <div className="mp-role">{role}</div>}
            {avg > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  justifyContent: "center",
                  color: "var(--muted)",
                  fontSize: 14,
                }}
              >
                <StarRating value={Math.round(avg)} size="sm" />
                <span>{avg.toFixed(1)}</span>
              </div>
            )}
            <div className="mp-stats">
              <div className="mp-stat">
                <b>{count}</b>
                <span>Оценок</span>
              </div>
              <div className="mp-stat">
                <b>{mixes.length}</b>
                <span>Миксов</span>
              </div>
            </div>
          </div>

          <button
            className="primary block"
            onClick={() => navigate(`/guest/tip/${id}?name=${encodeURIComponent(displayName)}`)}
          >
            Оставить чаевые
          </button>

          <div className="section-title">Миксы мастера</div>
          {mixes.length === 0 ? (
            <div className="empty">
              <div className="em-ico">○</div>
              <div>У мастера пока нет миксов в меню</div>
            </div>
          ) : (
            mixes.map((m) => (
              <MixCard key={m.id} item={m} onClick={() => navigate(`/guest/mix/${m.id}`)} />
            ))
          )}

          <div className="section-title">Отзывы гостей</div>
          {reviews.length === 0 ? (
            <div className="empty">
              <div className="em-ico">○</div>
              <div>Пока нет отзывов</div>
            </div>
          ) : (
            reviews.map((r) => (
              <div
                className="review-item clickable"
                key={r.orderRecipeId}
                onClick={() => navigate(`/guest/mix/${r.recipeId}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="review-head">
                  <StarRating value={r.score ?? 0} size="sm" />
                  {r.recipeName && <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>{r.recipeName} →</span>}
                </div>
                {r.review && <p className="review-text">{r.review}</p>}
                {r.components.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <CompositionBars items={r.components} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Shell>
  );
}
