# МойДом — SaaS платформа для управляющих компаний

Монорепо: бэкенд (Hono + Prisma + PostgreSQL + Bun) + мобильное приложение (Expo SDK 56 + React Native).

## Структура репозитория

```
├── backend/        # REST API + WebSocket
├── mobile/         # Expo приложение
├── shared/         # Zod схемы (общие для backend и mobile)
└── docker-compose.yml
```

---

## Быстрый старт

### 1. Зависимости

Требования:

- [Bun](https://bun.sh) >= 1.1
- [Node.js](https://nodejs.org) >= 20 (для Expo / Metro)
- [Docker](https://www.docker.com) + Docker Compose (для PostgreSQL и Redis)

Установка пакетов (из корня монорепо):

```bash
npm install
```

### 2. Поднять базу данных и Redis

```bash
docker compose up -d
```

Это запустит PostgreSQL на порту `5432` и Redis на порту `6379`.

### 3. Настроить окружение

```bash
# Backend
cp backend/.env.example backend/.env
# Отредактируйте backend/.env: впишите реальные секреты

# Mobile
cp mobile/.env.example mobile/.env
# Для эмулятора оставьте localhost:3000
# Для реального устройства замените на LAN IP: http://192.168.x.x:3000
```

### 4. Применить миграции и заполнить тестовые данные

```bash
cd backend
bunx prisma migrate dev
bunx prisma db seed
```

### 5. Запустить бэкенд

```bash
cd backend
bun dev
```

API будет доступен на `http://localhost:3000`.

### 6. Запустить мобильное приложение

```bash
cd mobile
npx expo start
```

- Нажмите `a` для Android-эмулятора
- Нажмите `i` для iOS-симулятора
- Отсканируйте QR-код в Expo Go для тестирования на реальном устройстве

---

## Переменные окружения

### Backend (`backend/.env`)

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | Секрет для access токена (15 мин) |
| `JWT_REFRESH_SECRET` | Секрет для refresh токена (30 дней) |
| `SMSRU_API_KEY` | API ключ SMS.ru для OTP |
| `FIREBASE_PROJECT_ID` | Firebase проект для FCM push |
| `FIREBASE_PRIVATE_KEY` | Приватный ключ сервисного аккаунта Firebase |
| `FIREBASE_CLIENT_EMAIL` | Email сервисного аккаунта Firebase |
| `MEDIA_SERVER_URL` | URL медиасервера (RTSP → HLS, опционально) |
| `CAMERA_STREAM_SECRET` | Секрет для шифрования ссылок на камеры |
| `PORT` | Порт сервера (по умолчанию 3000) |
| `NODE_ENV` | `development` или `production` |

> В режиме `development` OTP-код выводится в консоль вместо отправки SMS.

### Mobile (`mobile/.env`)

| Переменная | Описание |
|---|---|
| `EXPO_PUBLIC_API_URL` | Базовый URL бэкенда |

---

## Сборка APK для тестирования (EAS Build)

### Предварительная настройка

1. **EAS аккаунт**: зарегистрируйтесь на [expo.dev](https://expo.dev) и установите CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Привязать проект**:
   ```bash
   cd mobile
   eas init
   # Скопируйте projectId из вывода в app.json → extra.eas.projectId
   ```

3. **Firebase**: добавьте `google-services.json` (Android) в папку `mobile/` — файл нужен для FCM.

### Сборка APK (preview)

```bash
cd mobile
eas build --profile preview --platform android
```

После завершения (5–15 мин) EAS пришлёт ссылку на APK.

### Сборка для продакшна

```bash
# Android (AAB для Google Play)
eas build --profile production --platform android

# iOS (IPA для App Store)
eas build --profile production --platform ios
```

### Публикация

```bash
eas submit --platform android
eas submit --platform ios
```

---

## Роли пользователей

| Роль | Доступ |
|---|---|
| `SUPER_ADMIN` | Управление организациями |
| `ORG_ADMIN` | Управление ЖК, сотрудниками |
| `ORG_MANAGER` | Работа с заявками, счётчиками, объявлениями |
| `RESIDENT` | Свои заявки, счётчики, чат |

---

## API эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/auth/send-otp` | Отправить OTP на телефон |
| `POST` | `/auth/verify-otp` | Подтвердить OTP, получить токены |
| `POST` | `/auth/refresh` | Обновить access токен |
| `POST` | `/auth/logout` | Выйти (инвалидировать сессию) |
| `GET` | `/auth/profile` | Профиль текущего пользователя |
| `GET` | `/tickets` | Список заявок |
| `POST` | `/tickets` | Создать заявку |
| `GET` | `/tickets/:id` | Детали заявки |
| `PATCH` | `/tickets/:id/status` | Изменить статус |
| `POST` | `/tickets/:id/comments` | Добавить комментарий |
| `GET` | `/announcements` | Список объявлений |
| `POST` | `/announcements` | Создать объявление |
| `GET` | `/meters` | Счётчики квартиры |
| `POST` | `/meters/:id/readings` | Передать показание |
| `GET` | `/chat/rooms` | Список чат-комнат |
| `GET` | `/chat/:roomId/history` | История сообщений |
| `WS` | `/chat/ws?token=...` | WebSocket подключение |
| `POST` | `/push/tokens` | Зарегистрировать push токен |
| `DELETE` | `/push/tokens/:token` | Удалить push токен |
