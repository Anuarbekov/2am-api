# Locomotive Digital Twin API

Backend система для мониторинга и анализа телеметрии рельсовой системы в реальном времени.

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)

## Описание

Locomotive Digital Twin API — это сервер для визуализации и анализа телеметрии в реальном времени для систем рельсового транспорта (локомотив, вагоны). Система собирает, обрабатывает и анализирует 6 ключевых параметров работы:

- Топливо (уровень бака)
- Давление (системное давление)
- Температура (терморегуляция)
- Скорость (линейная скорость движения)
- Тормоз (состояние тормозной системы)
- Двигатель (эффективность силовой установки)

### Основная идея

Система превращает хаотичные параметры датчиков в единую оценку здоровья локомотива: score (0-100) + буква (A-E). Используется трёхуровневая фильтрация (валидация, EMA, медиана) и контекстная оценка.

## Функции

- Live-поток телеметрии через Socket.IO
- REST API для запросов истории и отчетов
- Индекс здоровья
- Воспроизведение данных из CSV
- Фильтрация сигналов: валидация, экспоненциальное сглаживание, медианная фильтрация
- WebSocket поддержка для браузеров и внешних клиентов

## Установка

### Предварительные требования

- Node.js (версия 18+)
- PostgreSQL (версия 12+)
- npm или yarn

### Шаги установки

1. Клонируйте репозиторий:
   ```bash
   git clone <repository-url>
   cd 2am-api
   ```

2. Установите зависимости:
   ```bash
   npm install
   ```

3. Настройте базу данных:
   - Создайте базу данных PostgreSQL
   - Обновите конфигурацию в .env
    ```
    DB_HOST=
    DB_PORT=
    DB_USERNAME=
    DB_PASSWORD=
    DB_NAME=
    PORT=
    ```

4. Запустите приложение:
   ```bash
   # Режим разработки
   npm run start:dev

   # Продакшн
   npm run start:prod
   ```

## Использование

### Доступ к API

- Swagger документация: http://localhost:3000/api/docs

### Примеры запросов

#### REST API

Получить первые телеметрические данные:
curl http://localhost:3000/api/telemetry

Получить историю за время (from, to):
curl http://localhost:3000/api/telemetry/history?from=2026-04-04T17%3A00%3A00Z&to=2026-04-04T17%3A10%3A00Z)

#### WebSocket

Подключитесь к Socket.IO на ```/telemetry``` для получения live-потока.

Пример ответа:
```
{
  "timestamp": "2026-04-04T17:15:30.123Z",
  "effective": {
    "temp": 85.3,
    "pressure": 8.45,
    "fuel": 745.2,
    "speed": 65.4,
    "engine": 92.5,
    "brake": 98.0
  },
  "healthIndex": {
    "score": 87,
    "grade": "A",
    "factors": [
      {
        "parameter": "temp",
        "status": "normal",
        "message": "Temperature is within a healthy range."
      }
      // ... остальные параметры
    ]
  }
}
```
## Архитектура

### Модульная структура
```
app.module.ts (главный модуль)
├── TypeORM (PostgreSQL) — БД для хранения телеметрии
├── Socket.IO Gateway (/ws/telemetry) — WebSocket для браузеров
├── History WebSocket (/ws/telemetry/history?from...&to...) — WebSocket для истории
└── Сервисы обработки:
    ├── SignalProcessingService — фильтрация и сглаживание
    ├── HealthIndexService — расчет индекса здоровья
    ├── RawTelemetryService — доступ к БД
    ├── TelemetryRawWsService — воспроизведение потока
    ├── CsvImportService — загрузка CSV
    └── CsvBootstrapService — инициализация при старте
```
### Поток данных
```
CSV файл (loco_telemetry.csv)
    ↓
CsvBootstrapService (загружает при старте)
    ↓
PostgreSQL (raw_telemetry таблица)
    ↓
RawTelemetryService
    ↓
SignalProcessingService (фильтрация: валидация → EMA → медиана)
    ↓
ProcessedTelemetry (очищенные данные)
    ↓
HealthIndexService (расчет оценки + объяснения)
    ↓
Socket.IO / Raw WebSocket / REST API
    ↓
Фронтенд-клиент / внешний клиент
```
## Технологии

- Backend: NestJS, TypeScript
- База данных: PostgreSQL, TypeORM
- WebSocket: Socket.IO
- Обработка данных: Кастомные сервисы фильтрации сигналов
- Документация: Swagger

# Скрипты
## Установка зависимостей
npm install

## Запуск в режиме разработки
npm run start:dev

## Сборка проекта
npm run build

## Запуск в продакшене
npm run start:prod

## Линтинг
npm run lint

# Лицензия

HackNU 26
