-- ============================================================
-- FINAL COMPLETE DATABASE FIX - RUN THIS ONCE
-- ============================================================
-- This script adds ALL missing columns to ALL tables
-- It will NOT delete any existing data
-- Run: psql "postgresql://postgres:Ziyodilloh_06@127.0.0.1:5432/tavba" -f final-fix.sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE - Add all missing columns
-- ============================================================
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fullName" VARCHAR;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totalXP" INTEGER DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "level" INTEGER DEFAULT 1;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "testsCompleted" INTEGER DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "zikrCount" INTEGER DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramPhone" VARCHAR;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramUsername" VARCHAR;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP DEFAULT NOW();
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" VARCHAR;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" VARCHAR DEFAULT 'USER';

-- Update fullName from existing data if empty
UPDATE "users" SET "fullName" = COALESCE("firstName" || ' ' || "lastName", "username") WHERE "fullName" IS NULL;
UPDATE "users" SET "totalXP" = COALESCE("xp", 0) WHERE "totalXP" = 0 OR "totalXP" IS NULL;

-- ============================================================
-- CATEGORIES TABLE - Add all missing columns
-- ============================================================
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "nameEn" VARCHAR;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "nameRu" VARCHAR;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "group" VARCHAR DEFAULT 'other';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "difficultyLevels" TEXT DEFAULT 'Oson,Orta,Qiyin';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "icon" VARCHAR;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "color" VARCHAR DEFAULT '#6366f1';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW();
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW();

-- ============================================================
-- QUESTIONS TABLE - Add all missing columns
-- ============================================================
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "xpReward" INTEGER DEFAULT 1;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "levelIndex" INTEGER DEFAULT 0;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "difficulty" VARCHAR DEFAULT 'MEDIUM';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW();
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW();

-- ============================================================
-- ZIKRS TABLE - Add all missing columns
-- ============================================================
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "titleArabic" VARCHAR;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "titleLatin" VARCHAR;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "textArabic" TEXT;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "textLatin" TEXT;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "emoji" VARCHAR DEFAULT '📿';
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "xpReward" INTEGER DEFAULT 1;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "isRamadan" BOOLEAN DEFAULT false;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "dayOfWeek" INTEGER DEFAULT 0;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "count" INTEGER DEFAULT 33;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW();
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW();

-- Update zikrs with existing data
UPDATE "zikrs" SET "titleArabic" = COALESCE("arabicText", "name", '') WHERE "titleArabic" IS NULL;
UPDATE "zikrs" SET "titleLatin" = COALESCE("name", '') WHERE "titleLatin" IS NULL;
UPDATE "zikrs" SET "textArabic" = COALESCE("arabicText", '') WHERE "textArabic" IS NULL;
UPDATE "zikrs" SET "textLatin" = COALESCE("transliteration", '') WHERE "textLatin" IS NULL;

-- ============================================================
-- ZIKR_COMPLETIONS TABLE - Add all missing columns
-- ============================================================
ALTER TABLE "zikr_completions" ADD COLUMN IF NOT EXISTS "xpEarned" INTEGER DEFAULT 0;
ALTER TABLE "zikr_completions" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW();

-- ============================================================
-- TEST_ATTEMPTS TABLE - Create if not exists or add columns
-- ============================================================
CREATE TABLE IF NOT EXISTS "test_attempts" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT,
    "categoryId" UUID,
    "score" INTEGER DEFAULT 0,
    "totalQuestions" INTEGER DEFAULT 0,
    "correctAnswers" INTEGER DEFAULT 0,
    "xpEarned" INTEGER DEFAULT 0,
    "timeSpent" INTEGER DEFAULT 0,
    "completedAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "test_attempts" ADD COLUMN IF NOT EXISTS "score" INTEGER DEFAULT 0;
ALTER TABLE "test_attempts" ADD COLUMN IF NOT EXISTS "totalQuestions" INTEGER DEFAULT 0;
ALTER TABLE "test_attempts" ADD COLUMN IF NOT EXISTS "correctAnswers" INTEGER DEFAULT 0;
ALTER TABLE "test_attempts" ADD COLUMN IF NOT EXISTS "xpEarned" INTEGER DEFAULT 0;
ALTER TABLE "test_attempts" ADD COLUMN IF NOT EXISTS "timeSpent" INTEGER DEFAULT 0;
ALTER TABLE "test_attempts" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP;
ALTER TABLE "test_attempts" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW();
ALTER TABLE "test_attempts" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW();

-- ============================================================
-- TEST_ANSWERS TABLE - Create if not exists or add columns
-- ============================================================
CREATE TABLE IF NOT EXISTS "test_answers" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "testAttemptId" UUID,
    "questionId" UUID,
    "selectedAnswer" INTEGER DEFAULT 0,
    "isCorrect" BOOLEAN DEFAULT false,
    "timeSpent" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "test_answers" ADD COLUMN IF NOT EXISTS "selectedAnswer" INTEGER DEFAULT 0;
ALTER TABLE "test_answers" ADD COLUMN IF NOT EXISTS "isCorrect" BOOLEAN DEFAULT false;
ALTER TABLE "test_answers" ADD COLUMN IF NOT EXISTS "timeSpent" INTEGER DEFAULT 0;
ALTER TABLE "test_answers" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW();

-- ============================================================
-- CATEGORY_STATS TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "category_stats" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT,
    "categoryId" UUID,
    "testsCompleted" INTEGER DEFAULT 0,
    "questionsAnswered" INTEGER DEFAULT 0,
    "correctAnswers" INTEGER DEFAULT 0,
    "xpEarned" INTEGER DEFAULT 0,
    "bestScore" INTEGER DEFAULT 0,
    "lastTestAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ACHIEVEMENTS TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "achievements" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "icon" VARCHAR,
    "type" VARCHAR DEFAULT 'test',
    "requirement" INTEGER DEFAULT 1,
    "xpReward" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- USER_ACHIEVEMENTS TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "user_achievements" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT,
    "achievementId" UUID,
    "unlockedAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT,
    "type" VARCHAR DEFAULT 'info',
    "title" VARCHAR DEFAULT '',
    "message" TEXT,
    "data" JSONB,
    "isRead" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- AI_CHATS TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_chats" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT,
    "categoryId" UUID,
    "message" TEXT,
    "response" TEXT,
    "tokensUsed" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "ai_chats" ADD COLUMN IF NOT EXISTS "categoryId" UUID;

-- ============================================================
-- ADMIN_MESSAGES TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "admin_messages" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "adminId" TEXT,
    "type" VARCHAR DEFAULT 'notification',
    "title" VARCHAR,
    "message" TEXT,
    "recipients" JSONB,
    "sentCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SETTINGS TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "settings" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "key" VARCHAR NOT NULL UNIQUE,
    "value" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- DESIGN_SETTINGS TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "design_settings" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "key" VARCHAR NOT NULL UNIQUE,
    "value" TEXT,
    "type" VARCHAR DEFAULT 'string',
    "category" VARCHAR DEFAULT 'general',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- WEEKLY_XP TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "weekly_xp" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT,
    "xp" INTEGER DEFAULT 0,
    "weekStart" DATE,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MONTHLY_XP TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "monthly_xp" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT,
    "xp" INTEGER DEFAULT 0,
    "monthStart" DATE,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- EMAIL_VERIFICATIONS TABLE - Create if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "email_verifications" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT,
    "email" VARCHAR,
    "code" VARCHAR,
    "expiresAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CREATE INDEXES (ignore if exists)
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_users_telegram" ON "users"("telegramId");
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users"("username");
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");
CREATE INDEX IF NOT EXISTS "idx_users_xp" ON "users"("totalXP");
CREATE INDEX IF NOT EXISTS "idx_categories_slug" ON "categories"("slug");
CREATE INDEX IF NOT EXISTS "idx_categories_active" ON "categories"("isActive");
CREATE INDEX IF NOT EXISTS "idx_categories_group" ON "categories"("group");
CREATE INDEX IF NOT EXISTS "idx_questions_category" ON "questions"("categoryId");
CREATE INDEX IF NOT EXISTS "idx_questions_difficulty" ON "questions"("difficulty");
CREATE INDEX IF NOT EXISTS "idx_questions_active" ON "questions"("isActive");
CREATE INDEX IF NOT EXISTS "idx_zikrs_day" ON "zikrs"("dayOfWeek");
CREATE INDEX IF NOT EXISTS "idx_zikrs_active" ON "zikrs"("isActive");
CREATE INDEX IF NOT EXISTS "idx_zikrs_ramadan" ON "zikrs"("isRamadan");
CREATE INDEX IF NOT EXISTS "idx_test_attempts_user" ON "test_attempts"("userId");
CREATE INDEX IF NOT EXISTS "idx_test_attempts_category" ON "test_attempts"("categoryId");
CREATE INDEX IF NOT EXISTS "idx_test_answers_attempt" ON "test_answers"("testAttemptId");
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications"("userId");
CREATE INDEX IF NOT EXISTS "idx_ai_chats_user" ON "ai_chats"("userId");
CREATE INDEX IF NOT EXISTS "idx_zikr_completions_user" ON "zikr_completions"("userId");

-- ============================================================
-- DONE!
-- ============================================================
SELECT '✅ ALL TABLES AND COLUMNS FIXED SUCCESSFULLY!' as result;
