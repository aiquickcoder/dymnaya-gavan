# HookahCRM Staff (Flutter)

Приложение персонала: пуш о вызове гостя («Позвать»: мастер / угли / официант / счёт),
живой список активных вызовов, «Принял». MVP.

## Что уже есть в репозитории
- `lib/` — весь код приложения (вход, смена, вызовы, FCM, API-клиент).
- `pubspec.yaml` — зависимости.
- Платформенные папки `android/` и `ios/` **не** коммитятся — генерируются локально.

## 1. Сгенерировать платформенные папки
Flutter SDK ≥ 3.4. В папке `mobile/`:

```bash
flutter create --org ru.hookahcrm --project-name hookahcrm_staff --platforms=android,ios .
# flutter create может перезаписать lib/main.dart и pubspec.yaml — верните наши:
git checkout -- lib pubspec.yaml
flutter pub get
```

## 2. Firebase (FCM для iOS+Android)
1. Создать проект в Firebase Console, добавить Android (`ru.hookahcrm.hookahcrm_staff`) и iOS.
2. Проще всего: `dart pub global activate flutterfire_cli && flutterfire configure`
   (сгенерит нативную конфигурацию; `Firebase.initializeApp()` подхватит её).
   Либо вручную: `google-services.json` → `android/app/`, `GoogleService-Info.plist` → `ios/Runner/`.
3. **iOS:** в Firebase → Cloud Messaging загрузить **APNs Auth Key** (.p8). В Xcode для Runner
   включить capabilities **Push Notifications** и **Background Modes → Remote notifications**.
4. **Android:** плагин `com.google.gms.google-services` (flutterfire добавит). Канал `calls`
   и запрос разрешения (Android 13+) — уже в коде (`lib/fcm.dart`).

## 3. Запуск
```bash
flutter run --dart-define=API_BASE=https://<адрес-бэкенда>
# по умолчанию http://localhost:8080
```

## 4. Что нужно на бэкенде (уже реализовано)
- `POST /devices/register {employeeId, restaurantId, platform, token}` / `/devices/unregister {token}`.
- `POST /calls/list`, `POST /calls/{id}/ack|done`, `POST /restaurants/employees {code}`,
  `GET|POST /restaurants/{id}/shift`.
- Env для пушей: `FCM_CREDENTIALS_FILE` (service-account JSON), `FCM_PROJECT_ID`;
  прогнать миграцию `00008_devices.sql`. Без них сервер работает, но пуши не уходят.

## Поток
```
Гость «Позвать» → POST /calls → бэк шлёт FCM сотрудникам на смене
Приложение: вход по коду → выбор себя → регистрация токена (/devices/register)
            смена ВКЛ = добавить себя в сегодняшний ростер (получать пуши)
            вызов пришёл (пуш + поллинг 8с) → «Принял» (/ack) → «Выполнено» (/done)
```

## Структура
```
lib/
  main.dart          Firebase init + роутинг (сессия → Вход/Вызовы)
  config.dart        API_BASE, интервал поллинга
  models.dart        Restaurant / Employee / Call
  api.dart           ApiClient (конверт {data,error})
  session.dart       shared_preferences (заведение + сотрудник)
  fcm.dart           FCM: разрешение, токен, foreground/background, re-register
  theme.dart         Бренд (оранжевый/крем)
  screens/
    login_screen.dart  код → выбор сотрудника
    calls_screen.dart  смена-свитч + активные вызовы + Принял/Выполнено
```

## Дальше (фаза 2)
SSE/WS live-список вместо поллинга · маршрут пуша по роли/зоне · схлопывание пуша
по ack у остальных · критические алерты iOS · PIN на входе · deep-link из пуша в вызов.
