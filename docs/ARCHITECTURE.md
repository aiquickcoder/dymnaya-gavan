# mixMaster — Архитектура бэкенда

Документ фиксирует модель данных, жизненный цикл заказа, роли и эндпоинты.
Источник истины по архитектурным решениям. Менять — осознанно.

---

## 1. Акторы и сценарий

- **Аноним** — зашёл, указал стол, смотрит заказ. В избранное добавлять не может.
- **Гость (User)** — зарегистрирован по телефону. Может сохранять рецепты в избранное.
- **Сотрудник (Employee)** — привязан к ресторану, создаёт рецепты и вешает их на столы.

**Основной флоу:**
1. Гость указывает `restaurantId` + `tableId`.
2. Открытие стола идемпотентно: есть активный заказ — вернём его; нет — создадим пустой.
3. Сотрудник создаёт рецепт (или берёт готовый) и закрепляет на заказе стола.
4. Гость видит на заказе рецепты, их состав и автора.
5. Гость (если зарегистрирован) сохраняет рецепт из заказа в избранное.
6. Гость ушёл — сотрудник обнуляет стол: заказ закрывается, стол снова свободен.

---

## 2. Модель данных

> ID — `UUID`. Имена таблиц — как ниже (смешанный стиль сохранён намеренно).
> У таблиц есть `createdAt`; у изменяемых — `updatedAt` (UTC).
> ER-диаграмма: [`schema.mmd`](schema.mmd) (mermaid `erDiagram`).

### Restaurant
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID | |
| name | string | |
| code | string | секрет; доступ к редактированию сотрудников и привязке |

### Employee
| Поле | Тип |
|---|---|
| id | UUID |
| firstName | string |
| lastName | string |
| middleName | string |
| shortName | string |

### EmployeeRestaurant
| Поле | Тип | Прим. |
|---|---|---|
| employeeId | UUID FK |
| restaurantId | UUID FK |
| rating | number? | зарезервировано, логики пока нет |
| position | string? | грейд мастера в этом заведении (напр. «Старший мастер») |

### Recipes  *(иммутабелен после создания)*
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| name | string? | необязательное |
| strength | int? | крепость 1..10 (обязательна на создании через API) |
| is_secret | bool | «секретный вкус» — состав скрыт до раскрытия |

### Components  *(иммутабелен после создания)*
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| recipeId | UUID FK | many-to-one к Recipes |
| brand | string | напр. `DS` |
| flavour | string | напр. `apple` |
| percent | number | напр. `20` |

### Orders
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| tableId | string |
| restaurantId | UUID FK |
| userId | UUID? | гость может быть анонимным |
| createdAt | timestamp |
| closedAt | timestamp? | `null` = открыт; ставится при обнулении стола |

### TableAssignment  *(указатель «текущий активный заказ на столе»)*
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| restaurantId | UUID FK |
| tableId | string |
| orderId | UUID FK |
| updatedAt | timestamp |

Уникальный индекс: `(restaurantId, tableId)` — один стол = максимум одна запись.

### OrderRecipe  *(что и кто приготовил в рамках заказа)*
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| orderId | UUID FK |
| recipeId | UUID FK |
| employeeId | UUID FK | снимок автора |
| removedAt | timestamp? | soft-снятие рецепта с заказа |

### Users
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| phoneNumber | string | уникальный, идентификатор гостя |
| gender | string |

### Favourites
| Поле | Тип | Прим. |
|---|---|---|
| userId | UUID FK |
| orderRecipeId | UUID FK | ссылка на OrderRecipe → состав + автор + ресторан |
| likedAt | timestamp |

**Ключевая связь избранного:**
```
Favourites.orderRecipeId
  → OrderRecipe(recipeId, employeeId, orderId)
      ├─ recipeId   → Recipes → Components   (состав)
      ├─ employeeId → Employee               (кто делал)
      └─ orderId    → Orders                 (ресторан)
```

---

### Оценки, отзывы, смены, меню

### employee_ratings  *(оценка мастера гостем)*
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| employee_id | UUID FK |
| user_id | UUID FK | кто оценил |
| score | int | 1..5 |
| — | | unique (employee_id, user_id), upsert |

### order_recipe_feedback  *(оценка и/или отзыв на OrderRecipe)*
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| order_recipe_id | UUID FK |
| user_id | UUID FK |
| score | int? | 1..5 |
| review | text? | текстовый отзыв |
| — | | unique (order_recipe_id, user_id), upsert |

### shifts  *(кто на смене сегодня)*
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| restaurant_id | UUID FK |
| employee_id | UUID FK |
| shift_date | date | default current_date |
| — | | unique (restaurant_id, employee_id, shift_date) |

### menu_recipes  *(меню заведения — отдельная сущность)*
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID |
| restaurant_id | UUID FK |
| author_employee_id | UUID FK | мастер-автор |
| name | text |
| description | text |
| strength | int | 1..10 |
| price | float |
| rating | float? |
| badge | text? | ярлык позиции (ХИТ / LIMITED / ЗВЕЗДА …) |
| tags | text[] | ровно 3 |
| removed_at | timestamp? | soft-remove |

---

## 3. Жизненный цикл заказа

```
СТОЛ СВОБОДЕН            нет записи в TableAssignment(restaurantId, tableId)
      │  гость указал стол → Order(closedAt=null) + TableAssignment
      ▼
СТОЛ ЗАНЯТ              TableAssignment → orderId,  Order.closedAt = null
      │  сотрудник вешает рецепты → OrderRecipe
      │  обнуление: DELETE TableAssignment + Order.closedAt = now()
      ▼
СТОЛ СВОБОДЕН            Order закрыт и остаётся в истории, OrderRecipe жив
```

---

## 4. Правила

### Общие
- **R1.1** ID — `UUID`.
- **R1.2** Таблицы имеют `createdAt`; изменяемые — `updatedAt` (UTC).
- **R1.3** Ответ API — конверт `{ data, error }`.

### Данные и связи
- **R2.1** `Recipes.name` — необязательное.
- **R2.2** `Components` принадлежит одному `Recipes` (many-to-one).
- **R2.3** `OrderRecipe` хранит снимок автора (`employeeId`).
- **R2.4** `Favourites` ссылается на `orderRecipeId` (не на `recipeId`).
- **R2.5** Уникальность `TableAssignment(restaurantId, tableId)`.
- **R2.6** Запрет каскадного удаления для `Orders`, `OrderRecipe`, `Recipes`.
- **R2.7** Сумма `percent` всех компонентов одного рецепта = ровно **100** (количество компонентов любое, каждый `percent > 0`). Проверяется на уровне приложения при создании рецепта (рецепты иммутабельны — R5.2, поэтому достаточно проверки на входе).
- **R2.8** Оценки (мастера и рецепта в заказе) — целое **1..5**. Одна оценка на пару (актор, объект), upsert. Оценивать может только зарегистрированный гость. «Оценка мастера» = среднее по всем его оценкам.
- **R2.9** `menu_recipes`: `strength` ∈ 1..10, `tags` — ровно 3 строки, `price ≥ 0`; «убрать из меню» = soft-remove (`removed_at`).
- **R2.10** Смену устанавливают по `Restaurant.code` (замена состава на сегодня целиком); читают по `restaurantId` (доступно и гостю).
- **R2.11** `Recipes.strength` ∈ 1..10 — обязательна при создании через API (у старых рецептов nullable). `is_secret` — флаг скрытого состава. Крепость и флаг возвращаются во всех представлениях рецепта (заказ, избранное, отзывы).
- **R2.12** `EmployeeRestaurant.position` — грейд мастера в заведении (текст); отдаётся в списке логина и в составе смены. `menu_recipes.badge` — текстовый ярлык позиции меню.

### Жизненный цикл
- **R3.1** Активность стола определяется **только** через `TableAssignment`.
- **R3.2** Один стол = максимум один активный заказ.
- **R3.3** Открытие стола идемпотентно (`get-or-create`).
- **R3.4** Закрытый заказ (`closedAt != null`) иммутабелен. Новое посещение = новый `Order`.
- **R3.5** Обнуление стола = `DELETE TableAssignment` + `Orders.closedAt = now()` в одной транзакции.
- **R3.6** Закрыть можно и пустой заказ.
- **R3.7** `OrderRecipe` физически не удаляется никогда.
- **R3.8** Снятие/замена рецепта = `OrderRecipe.removedAt = now()`. Замена = снять старый + создать новый. Активный заказ показывает только `removedAt = null`.

### Доступ
- **R4.1** Гость — по `phoneNumber` (без верификации на MVP, OTP позже).
- **R4.2** Аноним смотрит заказ, но не добавляет в избранное.
- **R4.3** Сотрудник работает только с ресторанами, где состоит (`EmployeeRestaurant`).
- **R4.4** `Restaurant.code` — секрет: привязка сотрудника и доступ к редактированию сотрудников.
- **R4.5** Автор фиксируется в `OrderRecipe.employeeId` при закреплении.
- **R4.6** Логин сотрудника: `Restaurant.code` + выбор себя из списка сотрудников ресторана.
- **R4.7** Рейтинг пока не реализуется.

### Целостность и история
- **R5.1** История append-only. Hard-delete разрешён только для `TableAssignment`.
- **R5.2** `Recipes` и `Components` иммутабельны. «Изменить рецепт» = создать новый.
- **R5.3** Soft-маркеры: `Orders.closedAt`, `OrderRecipe.removedAt`.
- **R5.4** Снимок автора — `OrderRecipe.employeeId`.
- **R5.5** Имя сотрудника в истории/избранном берётся из живого `Employee`: сменил ФИО → новое ФИО везде.

### Эндпоинты
- **R6.1** REST + JSON, конверт `{ data, error }`.
- **R6.2** Batch-чтение: `POST /<resource>/batch` с телом `{ ids: [...] }`.
- **R6.3** Эндпоинты сотрудника требуют скоупа ресторана; избранное требует `userId`.

---

## 5. Эндпоинты

> Секретный `code` всегда в теле запроса, не в URL (R1.5). Batch — `POST /<resource>/batch` (R6.2).

### Restaurant / Employee
| Описание | Метод и путь |
|---|---|
| Создать ресторан → вернуть `code` | `POST /restaurants` |
| Регистрация сотрудника в ресторане (по `code`) → `Employee` + `EmployeeRestaurant` | `POST /employees` |
| Привязка сотрудника к ещё одному ресторану (по `code`) → новый `EmployeeRestaurant` | `POST /employees/{id}/restaurants` |
| Изменить сотрудника (ФИО / shortName) | `PATCH /employees/{id}` |
| Получить сотрудников по id (batch) | `POST /employees/batch` |
| Список сотрудников ресторана по `code` (для логина) | `POST /restaurants/employees` (body: `code`) |

### Recipes
| Описание | Метод и путь |
|---|---|
| Создать рецепт (+ компоненты) | `POST /recipes` |
| Получить рецепты по id (batch) — в ответе компоненты | `POST /recipes/batch` |

### Orders
| Описание | Метод и путь |
|---|---|
| Открыть стол (get-or-create, идемпотентно) | `POST /orders/open` |
| Закрепить рецепт на заказе | `POST /orders/{id}/recipes` |
| Снять/заменить рецепт (soft, `removedAt`) | `DELETE /orders/{id}/recipes/{orderRecipeId}` |
| Обнулить стол (`DELETE TableAssignment` + `closedAt`) | `POST /orders/{id}/close` |

### Users / Favourites
| Описание | Метод и путь |
|---|---|
| Регистрация гостя (`phoneNumber` + `gender`) | `POST /users` |
| Получить данные гостя | `GET /users/{id}` |
| Получить избранное — обогащённое: ресторан + компоненты + автор + **моя оценка и отзыв** | `GET /users/{id}/favourites` |
| Добавить рецепт в избранное | `POST /users/{id}/favourites` |
| Удалить рецепт из избранного | `DELETE /users/{id}/favourites/{orderRecipeId}` |

### Оценки и отзывы
| Описание | Метод и путь |
|---|---|
| Оценить мастера (1..5) | `POST /employees/{id}/ratings` |
| Оценка мастера (среднее + количество) | `GET /employees/{id}/rating` |
| Оценки, поставленные мастеру | `GET /employees/{id}/ratings` |
| Отзывы и оценки на рецепты мастера (с компонентами) | `GET /employees/{id}/recipe-feedback` |
| Оценить рецепт в заказе (1..5) | `POST /order-recipes/{orderRecipeId}/rating` |
| Оставить отзыв на рецепт в заказе | `POST /order-recipes/{orderRecipeId}/review` |

### Смены
| Описание | Метод и путь |
|---|---|
| Установить состав смены на сегодня (по `code`) | `POST /restaurants/shift` |
| Мастера на смене сегодня (имя + shortName + оценка) | `GET /restaurants/{restaurantId}/shift` |

### Меню заведения
| Описание | Метод и путь |
|---|---|
| Создать рецепт в меню | `POST /menu` |
| Все рецепты меню заведения | `POST /menu/list` |
| Изменить рецепт меню | `PATCH /menu/{id}` |
| Убрать рецепт из меню (soft) | `DELETE /menu/{id}` |
