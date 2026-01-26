-- =====================================================
-- TAVBA DATABASE - INITIAL MIGRATION
-- TypeORM Entity Schema Based
-- Run this after dropping all tables
-- =====================================================

-- Drop old schema and create fresh
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Create custom enum types
CREATE TYPE "role_enum" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
CREATE TYPE "difficulty_enum" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "notification_type_enum" AS ENUM ('SYSTEM', 'ACHIEVEMENT', 'LEVEL_UP', 'RANKING', 'MESSAGE');

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE "users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) UNIQUE,
    "username" VARCHAR(255) NOT NULL UNIQUE,
    "password" VARCHAR(255),
    "fullName" VARCHAR(255) NOT NULL,
    "avatar" VARCHAR(255),
    "bio" TEXT,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "testsCompleted" INTEGER NOT NULL DEFAULT 0,
    "zikrCount" INTEGER NOT NULL DEFAULT 0,
    "role" role_enum NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "telegramId" VARCHAR(255) UNIQUE,
    "phone" VARCHAR(255),
    "telegramPhone" VARCHAR(255),
    "telegramUsername" VARCHAR(255),
    "lastActiveAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_users_email" ON "users"("email");
CREATE INDEX "idx_users_username" ON "users"("username");
CREATE INDEX "idx_users_totalXP" ON "users"("totalXP");
CREATE INDEX "idx_users_telegramId" ON "users"("telegramId");

-- =====================================================
-- 2. CATEGORIES TABLE
-- =====================================================
CREATE TABLE "categories" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "nameEn" VARCHAR(255),
    "nameRu" VARCHAR(255),
    "slug" VARCHAR(255) NOT NULL UNIQUE,
    "description" TEXT,
    "icon" VARCHAR(255),
    "color" VARCHAR(255) NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "group" VARCHAR(255) NOT NULL DEFAULT 'other',
    "difficultyLevels" TEXT NOT NULL DEFAULT 'Oson,Orta,Qiyin',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_categories_slug" ON "categories"("slug");
CREATE INDEX "idx_categories_isActive" ON "categories"("isActive");
CREATE INDEX "idx_categories_group" ON "categories"("group");

-- =====================================================
-- 3. QUESTIONS TABLE
-- =====================================================
CREATE TABLE "questions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "categoryId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctAnswer" INTEGER NOT NULL,
    "explanation" TEXT,
    "difficulty" difficulty_enum NOT NULL DEFAULT 'MEDIUM',
    "xpReward" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "levelIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_questions_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_questions_categoryId" ON "questions"("categoryId");
CREATE INDEX "idx_questions_difficulty" ON "questions"("difficulty");
CREATE INDEX "idx_questions_levelIndex" ON "questions"("levelIndex");
CREATE INDEX "idx_questions_isActive" ON "questions"("isActive");

-- =====================================================
-- 4. TEST ATTEMPTS TABLE
-- =====================================================
CREATE TABLE "test_attempts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID,
    "categoryId" UUID,
    "score" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 10,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "timeSpent" INTEGER,
    "completedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_test_attempts_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_test_attempts_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_test_attempts_userId" ON "test_attempts"("userId");
CREATE INDEX "idx_test_attempts_categoryId" ON "test_attempts"("categoryId");
CREATE INDEX "idx_test_attempts_createdAt" ON "test_attempts"("createdAt");

-- =====================================================
-- 5. TEST ANSWERS TABLE
-- =====================================================
CREATE TABLE "test_answers" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "testAttemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "selectedAnswer" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpent" INTEGER,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_test_answers_attempt" FOREIGN KEY ("testAttemptId") REFERENCES "test_attempts"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_test_answers_question" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_test_answers_testAttemptId" ON "test_answers"("testAttemptId");
CREATE INDEX "idx_test_answers_questionId" ON "test_answers"("questionId");

-- =====================================================
-- 6. CATEGORY STATS TABLE
-- =====================================================
CREATE TABLE "category_stats" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "averageScore" FLOAT NOT NULL DEFAULT 0,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_category_stats_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_category_stats_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE,
    CONSTRAINT "uq_category_stats_user_category" UNIQUE ("userId", "categoryId")
);

CREATE INDEX "idx_category_stats_userId" ON "category_stats"("userId");
CREATE INDEX "idx_category_stats_categoryId" ON "category_stats"("categoryId");
CREATE INDEX "idx_category_stats_totalXP" ON "category_stats"("totalXP");

-- =====================================================
-- 7. ACHIEVEMENTS TABLE
-- =====================================================
CREATE TABLE "achievements" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "nameEn" VARCHAR(255),
    "nameRu" VARCHAR(255),
    "description" TEXT NOT NULL,
    "icon" VARCHAR(255) NOT NULL,
    "condition" JSONB NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. USER ACHIEVEMENTS TABLE
-- =====================================================
CREATE TABLE "user_achievements" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_user_achievements_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_user_achievements_achievement" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE,
    CONSTRAINT "uq_user_achievements_user_achievement" UNIQUE ("userId", "achievementId")
);

CREATE INDEX "idx_user_achievements_userId" ON "user_achievements"("userId");

-- =====================================================
-- 9. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE "notifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" notification_type_enum NOT NULL DEFAULT 'SYSTEM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_notifications_userId" ON "notifications"("userId");
CREATE INDEX "idx_notifications_isRead" ON "notifications"("isRead");
CREATE INDEX "idx_notifications_createdAt" ON "notifications"("createdAt");

-- =====================================================
-- 10. AI CHATS TABLE
-- =====================================================
CREATE TABLE "ai_chats" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "categoryId" UUID,
    "message" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "tokens" INTEGER,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_ai_chats_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_ai_chats_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_ai_chats_userId" ON "ai_chats"("userId");
CREATE INDEX "idx_ai_chats_createdAt" ON "ai_chats"("createdAt");

-- =====================================================
-- 11. ADMIN MESSAGES TABLE
-- =====================================================
CREATE TABLE "admin_messages" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "adminId" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "targetType" VARCHAR(255) NOT NULL,
    "targetIds" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP,
    "sentAt" TIMESTAMP,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "channels" TEXT NOT NULL DEFAULT '',
    "emailSent" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" VARCHAR(255),
    "notifSent" INTEGER NOT NULL DEFAULT 0,
    "telegramSent" INTEGER NOT NULL DEFAULT 0,
    "videoUrl" VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_admin_messages_admin" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_admin_messages_adminId" ON "admin_messages"("adminId");
CREATE INDEX "idx_admin_messages_sentAt" ON "admin_messages"("sentAt");

-- =====================================================
-- 12. SETTINGS TABLE
-- =====================================================
CREATE TABLE "settings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "key" VARCHAR(255) NOT NULL UNIQUE,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 13. DESIGN SETTINGS TABLE
-- =====================================================
CREATE TABLE "design_settings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "theme" VARCHAR(255) NOT NULL DEFAULT 'default',
    "lightVideoUrl" VARCHAR(255),
    "darkVideoUrl" VARCHAR(255),
    "lightImageUrl" VARCHAR(255),
    "darkImageUrl" VARCHAR(255),
    "videoLoop" BOOLEAN NOT NULL DEFAULT true,
    "videoMuted" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 14. WEEKLY XP TABLE
-- =====================================================
CREATE TABLE "weekly_xp" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "weekStart" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_weekly_xp_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "uq_weekly_xp_user_week" UNIQUE ("userId", "weekStart")
);

CREATE INDEX "idx_weekly_xp_weekStart" ON "weekly_xp"("weekStart");
CREATE INDEX "idx_weekly_xp_xp" ON "weekly_xp"("xp");

-- =====================================================
-- 15. MONTHLY XP TABLE
-- =====================================================
CREATE TABLE "monthly_xp" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "monthStart" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_monthly_xp_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "uq_monthly_xp_user_month" UNIQUE ("userId", "monthStart")
);

CREATE INDEX "idx_monthly_xp_monthStart" ON "monthly_xp"("monthStart");
CREATE INDEX "idx_monthly_xp_xp" ON "monthly_xp"("xp");

-- =====================================================
-- 16. EMAIL VERIFICATIONS TABLE
-- =====================================================
CREATE TABLE "email_verifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "code" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_email_verifications_email" ON "email_verifications"("email");
CREATE INDEX "idx_email_verifications_code" ON "email_verifications"("code");
CREATE INDEX "idx_email_verifications_expiresAt" ON "email_verifications"("expiresAt");

-- =====================================================
-- 17. ZIKRS TABLE
-- =====================================================
CREATE TABLE "zikrs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "titleArabic" VARCHAR(255) NOT NULL,
    "titleLatin" VARCHAR(255) NOT NULL,
    "textArabic" TEXT NOT NULL,
    "textLatin" TEXT NOT NULL,
    "description" TEXT,
    "count" INTEGER NOT NULL DEFAULT 33,
    "emoji" VARCHAR(255) NOT NULL DEFAULT '📿',
    "dayOfWeek" INTEGER NOT NULL,
    "isRamadan" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "xpReward" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_zikrs_dayOfWeek" ON "zikrs"("dayOfWeek");
CREATE INDEX "idx_zikrs_isRamadan" ON "zikrs"("isRamadan");
CREATE INDEX "idx_zikrs_isActive" ON "zikrs"("isActive");
CREATE INDEX "idx_zikrs_order" ON "zikrs"("order");

-- =====================================================
-- 18. ZIKR COMPLETIONS TABLE
-- =====================================================
CREATE TABLE "zikr_completions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "zikrId" UUID NOT NULL,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_zikr_completions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_zikr_completions_zikr" FOREIGN KEY ("zikrId") REFERENCES "zikrs"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_zikr_completions_userId" ON "zikr_completions"("userId");
CREATE INDEX "idx_zikr_completions_zikrId" ON "zikr_completions"("zikrId");
CREATE INDEX "idx_zikr_completions_completedAt" ON "zikr_completions"("completedAt");

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Default design setting
INSERT INTO "design_settings" ("theme", "isActive") VALUES ('default', true);

-- Default categories
INSERT INTO "categories" ("name", "slug", "description", "icon", "color", "group", "order") VALUES
('Aqida', 'aqida', 'Islom e''tiqodi asoslari', '🕌', '#6366f1', 'asosiy', 1),
('Fiqh', 'fiqh', 'Islom huquqshunosligi', '📚', '#22c55e', 'asosiy', 2),
('Hadis', 'hadis', 'Payg''ambarimiz hadislari', '📖', '#f59e0b', 'asosiy', 3),
('Quron', 'quron', 'Quron ilmlari', '📗', '#3b82f6', 'asosiy', 4),
('Siyrat', 'seerat', 'Payg''ambarimiz hayoti', '⭐', '#ec4899', 'asosiy', 5);

-- Default achievements
INSERT INTO "achievements" ("name", "description", "icon", "condition", "xpReward", "order") VALUES
('Birinchi qadam', 'Birinchi testni yakunlang', '🎯', '{"type": "tests_completed", "value": 1}', 10, 1),
('Bilim izlovchi', '10 ta test yakunlang', '📚', '{"type": "tests_completed", "value": 10}', 50, 2),
('Zikr ustasi', '7 kun ketma-ket zikr qiling', '📿', '{"type": "zikr_streak", "value": 7}', 100, 3),
('100 XP', '100 XP to''plang', '💯', '{"type": "total_xp", "value": 100}', 20, 4),
('1000 XP', '1000 XP to''plang', '🏆', '{"type": "total_xp", "value": 1000}', 100, 5);

-- =====================================================
-- ADMIN USER - O'ZGARTIRING!
-- Password: admin123 (bcrypt hash)
-- Username: admin
-- =====================================================
INSERT INTO "users" (
    "email", 
    "username", 
    "password", 
    "fullName", 
    "role", 
    "isActive"
) VALUES (
    'admin@allohgaqayt.uz',
    'admin',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', -- admin123
    'Administrator',
    'ADMIN',
    true
);

-- =====================================================
-- DONE!
-- =====================================================
SELECT 'Migration completed successfully!' as status;
SELECT 'Admin user created: username=admin, password=admin123' as info;
