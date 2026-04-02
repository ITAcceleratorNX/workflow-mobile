# Deep Links: открытие заявки в приложении

Чтобы ссылки вида `http://localhost:3001?requestId=123` открывались в мобильном приложении (а не в браузере), нужна **двусторонняя верификация** между сайтом и приложением.

## Что уже сделано в приложении (workflow-mobile)

- В **app.json** настроены:
  - **iOS**: `associatedDomains: ["applinks:app.tmk-workflow.kz"]`
  - **Android**: `intentFilters` с `autoVerify: true` для `http://localhost:3001`
- При открытии ссылки приложение парсит `requestId` и открывает экран заявки `/(tabs)/requests/[id]`.

## Что нужно сделать на сайте (app.tmk-workflow.kz / kcell-service-front)

### 1. iOS — Universal Links

На домене **app.tmk-workflow.kz** должен быть доступен файл:

**URL:** `http://localhost:3001/.well-known/apple-app-site-association`  
(без расширения, Content-Type: `application/json`)

В **kcell-service-front** файл создан:  
`public/.well-known/apple-app-site-association`

**Важно:** замените `TEAM_ID` на ваш **Apple Team ID** (например из Apple Developer → Membership). Итоговая строка: `"appID": "XXXXXXXXXX.com.workflow.kz"`.

После деплоя проверьте: https://branch.io/resources/aasa-validator/ (введите `http://localhost:3001`).

### 2. Android — App Links

На домене должен быть доступен файл:

**URL:** `http://localhost:3001/.well-known/assetlinks.json`  
(Content-Type: `application/json`)

В **kcell-service-front** файл создан:  
`public/.well-known/assetlinks.json`

**Важно:** замените `REPLACE_WITH_SHA256_FINGERPRINT` на SHA-256 отпечаток сертификата подписи приложения (EAS Build: `eas credentials -p android` → SHA256 Fingerprint; или Google Play Console → Release → Setup → App Signing).

Можно указать несколько отпечатков (релизный ключ, upload key, отладочный).

### 3. Деплой

Убедитесь, что при деплое сайта папка `public/.well-known/` отдаётся по путям:

- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`

Проверка Android: https://developers.google.com/digital-asset-links/tools/generator или установка приложения и переход по ссылке (через 20+ секунд после установки верификация может обновиться).

## Итог

После настройки AASA и assetlinks на домене **app.tmk-workflow.kz** и пересборки мобильного приложения ссылки из «Поделиться в WhatsApp» будут открывать заявку в приложении, если оно установлено; иначе — на сайте в браузере.
