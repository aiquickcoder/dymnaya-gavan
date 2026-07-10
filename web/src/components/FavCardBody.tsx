import CompositionBars from "./CompositionBars";
import StarRating from "./StarRating";
import type { Favourite } from "../types";

/** Внутренности карточки избранного микса — общие для карусели в Профиле и экрана «Избранное». */
export default function FavCardBody({ fav, onRemove }: { fav: Favourite; onRemove: () => void }) {
  return (
    <>
      <div className="row between">
        <div className="display" style={{ fontSize: 17 }}>{fav.recipeName || "Микс"}</div>
        <button className="danger sm" onClick={(e) => { e.stopPropagation(); onRemove(); }}>Убрать</button>
      </div>
      <div className="muted small" style={{ marginBottom: 8 }}>
        {fav.restaurantName} · Мастер {fav.authorShortName || fav.authorFullName}
      </div>
      <CompositionBars items={fav.components} masked={fav.isSecret} />
      {fav.myScore != null && (
        <div className="row" style={{ marginTop: 8 }}>
          <span className="muted small">Моя оценка:</span>
          <StarRating value={fav.myScore} size="sm" />
        </div>
      )}
    </>
  );
}
