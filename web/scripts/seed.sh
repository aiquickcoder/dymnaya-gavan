#!/usr/bin/env bash
# Seed the mixMaster backend with a demo venue so the guest web shows real data.
# Requires: a running API (make run) and `jq`.
#
#   ./web/scripts/seed.sh
#
# Prints the guest deep-link URL at the end (QR target: ?r=<restaurantId>&t=<table>).
set -euo pipefail

API="${API:-http://localhost:8080}"
TABLE="${TABLE:-7}"

post() { curl -s -X POST "$API$1" -H 'Content-Type: application/json' -d "$2"; }

echo "→ creating restaurant…"
REST=$(post /restaurants '{"name":"Дымная Гавань"}')
RID=$(echo "$REST" | jq -r '.data.id')
CODE=$(echo "$REST" | jq -r '.data.code')
echo "  restaurantId=$RID  code=$CODE"

echo "→ registering masters…"
mk_emp() { # first last middle short position
  post /employees "$(jq -n --arg f "$1" --arg l "$2" --arg m "$3" --arg s "$4" --arg p "$5" --arg c "$CODE" \
    '{firstName:$f,lastName:$l,middleName:$m,shortName:$s,position:$p,code:$c}')" | jq -r '.data.employee.id'
}
E1=$(mk_emp "Тимур" "Азизов" "Русланович" "Тимур" "Старший мастер")
E2=$(mk_emp "Алина" "Ковалёва" "Игоревна" "Алина" "Кальянный мастер")
E3=$(mk_emp "Дин" "Соколов" "Артёмович" "Дин" "Стажёр")
echo "  $E1 / $E2 / $E3"

echo "→ setting today's shift…"
post /restaurants/shift "$(jq -n --arg c "$CODE" --argjson ids "[\"$E1\",\"$E2\",\"$E3\"]" '{code:$c,employeeIds:$ids}')" >/dev/null

echo "→ creating menu…"
mk_menu() { # author name desc strength price rating badge tag1 tag2 tag3
  post /menu "$(jq -n --arg r "$RID" --arg a "$1" --arg n "$2" --arg d "$3" \
    --argjson st "$4" --argjson pr "$5" --argjson rt "$6" --arg b "$7" \
    --argjson tags "[\"$8\",\"$9\",\"${10}\"]" \
    '{restaurantId:$r,authorEmployeeId:$a,name:$n,description:$d,strength:$st,price:$pr,rating:$rt,badge:$b,tags:$tags}')" >/dev/null
}
mk_menu "$E1" "Северное сияние" "Свежо и тропически, с прохладным шлейфом." 5 1200 4.8 "Хит"     "Манго" "Маракуйя" "Лёд"
mk_menu "$E2" "Гранатовый дым"  "Терпкий гранат с ягодной кислинкой."       7 1200 4.6 "MustHave" "Гранат" "Барбарис" "Мята"
mk_menu "$E1" "Тропик Лайт"     "Лёгкий, для долгого вечера."                3 1100 4.7 ""         "Кокос" "Личи" "Манго"
mk_menu "$E2" "Цитрус Стронг"   "Мощный цитрус для любителей крепкого."      9 1300 4.5 ""         "Лимон" "Грейпфрут" "Лёд"
mk_menu "$E1" "Тёмная сторона × MOON" "Коллаборация месяца." 6 1600 4.9 "Limited" "Виноград" "Черника" "Дыня"
mk_menu "$E3" "Секретный вкус"  "Заказ вслепую — доверьтесь мастеру."        6 1400 0   "?"        "Секрет" "Секрет" "Секрет"

echo "→ opening a table + preparing a mix (for the session screen)…"
ORD=$(post /orders/open "$(jq -n --arg r "$RID" --arg t "$TABLE" '{restaurantId:$r,tableId:$t}')")
OID=$(echo "$ORD" | jq -r '.data.id')
REC=$(post /recipes '{"name":"Северное сияние","strength":5,"isSecret":false,"components":[{"brand":"Darkside","flavour":"Манго","percent":40},{"brand":"Darkside","flavour":"Маракуйя","percent":35},{"brand":"Element","flavour":"Лёд","percent":25}]}')
RECID=$(echo "$REC" | jq -r '.data.id')
post "/orders/$OID/recipes" "$(jq -n --arg rec "$RECID" --arg emp "$E1" '{recipeId:$rec,employeeId:$emp}')" >/dev/null

echo "→ seeding guest ratings for the masters (so ★ ratings show)…"
TS=(5 5 5 5 5 4 5 5); AS=(5 4 5 5 4 5 4 5); DS=(4 5 4 4 5 4 5 4)
for i in $(seq 0 7); do
  uid=$(post /users "{\"phoneNumber\":\"+7922${RANDOM}${i}\"}" | jq -r '.data.id')
  [ "$uid" = "null" ] && continue
  post "/employees/$E1/ratings" "{\"userId\":\"$uid\",\"score\":${TS[$i]}}" >/dev/null
  post "/employees/$E2/ratings" "{\"userId\":\"$uid\",\"score\":${AS[$i]}}" >/dev/null
  post "/employees/$E3/ratings" "{\"userId\":\"$uid\",\"score\":${DS[$i]}}" >/dev/null
done

echo ""
echo "✓ seeded."
echo "  restaurantId : $RID"
echo "  staff code   : $CODE"
echo "  guest URL    : http://localhost:5173/guest?r=$RID&t=$TABLE"
