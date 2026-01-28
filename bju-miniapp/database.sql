-- ================================================
-- БЖУ Нутрициолог - Database Schema
-- ================================================

-- Таблица логов питания
CREATE TABLE IF NOT EXISTS nutrition_log (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    description TEXT,
    calories INT DEFAULT 0 CHECK (calories >= 0),
    protein DECIMAL(10,2) DEFAULT 0 CHECK (protein >= 0),
    fat DECIMAL(10,2) DEFAULT 0 CHECK (fat >= 0),
    carbs DECIMAL(10,2) DEFAULT 0 CHECK (carbs >= 0),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индекс для быстрого поиска по пользователю и дате
CREATE INDEX IF NOT EXISTS idx_nutrition_log_chat_date
ON nutrition_log(chat_id, created_at);

-- Индекс для поиска по пользователю
CREATE INDEX IF NOT EXISTS idx_nutrition_log_chat_id
ON nutrition_log(chat_id);

-- Таблица персональных целей пользователя
CREATE TABLE IF NOT EXISTS user_goals (
    chat_id BIGINT PRIMARY KEY,
    daily_calories INT DEFAULT 2000 CHECK (daily_calories > 0 AND daily_calories <= 10000),
    daily_protein INT DEFAULT 120 CHECK (daily_protein >= 0 AND daily_protein <= 500),
    daily_fat INT DEFAULT 65 CHECK (daily_fat >= 0 AND daily_fat <= 300),
    daily_carbs INT DEFAULT 250 CHECK (daily_carbs >= 0 AND daily_carbs <= 1000),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- Полезные запросы для аналитики
-- ================================================

-- Получить статистику за последние 7 дней
-- SELECT
--     DATE(created_at) as date,
--     SUM(calories) as total_calories,
--     SUM(protein) as total_protein,
--     SUM(fat) as total_fat,
--     SUM(carbs) as total_carbs,
--     COUNT(*) as meals_count
-- FROM nutrition_log
-- WHERE chat_id = :chat_id
-- AND created_at >= NOW() - INTERVAL '7 days'
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC;

-- Получить среднее потребление за месяц
-- SELECT
--     AVG(daily_calories) as avg_calories,
--     AVG(daily_protein) as avg_protein,
--     AVG(daily_fat) as avg_fat,
--     AVG(daily_carbs) as avg_carbs
-- FROM (
--     SELECT
--         DATE(created_at) as date,
--         SUM(calories) as daily_calories,
--         SUM(protein) as daily_protein,
--         SUM(fat) as daily_fat,
--         SUM(carbs) as daily_carbs
--     FROM nutrition_log
--     WHERE chat_id = :chat_id
--     AND created_at >= NOW() - INTERVAL '30 days'
--     GROUP BY DATE(created_at)
-- ) daily_stats;

-- Подсчёт streak (дней подряд с отслеживанием)
-- WITH dates AS (
--     SELECT DISTINCT DATE(created_at) as log_date
--     FROM nutrition_log
--     WHERE chat_id = :chat_id
--     ORDER BY log_date DESC
-- ),
-- numbered AS (
--     SELECT
--         log_date,
--         log_date - (ROW_NUMBER() OVER (ORDER BY log_date DESC))::int as grp
--     FROM dates
-- )
-- SELECT COUNT(*) as streak
-- FROM numbered
-- WHERE grp = (SELECT grp FROM numbered WHERE log_date = CURRENT_DATE);

-- ================================================
-- Миграция: добавить foreign key к subscriptions
-- ================================================

-- ALTER TABLE nutrition_log
-- ADD CONSTRAINT fk_nutrition_log_subscriptions
-- FOREIGN KEY (chat_id) REFERENCES subscriptions(id)
-- ON DELETE CASCADE;

-- ALTER TABLE user_goals
-- ADD CONSTRAINT fk_user_goals_subscriptions
-- FOREIGN KEY (chat_id) REFERENCES subscriptions(id)
-- ON DELETE CASCADE;

-- ================================================
-- Примеры данных для тестирования
-- ================================================

-- INSERT INTO nutrition_log (chat_id, meal_type, description, calories, protein, fat, carbs) VALUES
-- (123456789, 'breakfast', 'Овсянка с бананом и мёдом', 380, 12, 8, 65),
-- (123456789, 'lunch', 'Куриная грудка с рисом и овощами', 520, 45, 12, 55),
-- (123456789, 'snack', 'Греческий йогурт с орехами', 220, 15, 12, 14),
-- (123456789, 'dinner', 'Лосось на гриле с салатом', 450, 38, 28, 8);

-- INSERT INTO user_goals (chat_id, daily_calories, daily_protein, daily_fat, daily_carbs) VALUES
-- (123456789, 2000, 120, 65, 250);
