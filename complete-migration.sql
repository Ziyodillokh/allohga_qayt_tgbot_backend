-- COMPLETE DATABASE MIGRATION SCRIPT
-- This script adds all missing columns to match TypeORM entities
-- Run with: psql "postgresql://postgres:Ziyodilloh_06@127.0.0.1:5432/tavba" -f complete-migration.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- FIX USERS TABLE
-- =====================================================
DO $$
BEGIN
    -- Add missing columns to users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'fullName') THEN
        ALTER TABLE "users" ADD COLUMN "fullName" VARCHAR;
        UPDATE "users" SET "fullName" = COALESCE("firstName" || ' ' || "lastName", "username") WHERE "fullName" IS NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') THEN
        ALTER TABLE "users" ADD COLUMN "bio" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'totalXP') THEN
        ALTER TABLE "users" ADD COLUMN "totalXP" INTEGER DEFAULT 0;
        UPDATE "users" SET "totalXP" = COALESCE("xp", 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'testsCompleted') THEN
        ALTER TABLE "users" ADD COLUMN "testsCompleted" INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'zikrCount') THEN
        ALTER TABLE "users" ADD COLUMN "zikrCount" INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'telegramPhone') THEN
        ALTER TABLE "users" ADD COLUMN "telegramPhone" VARCHAR;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'telegramUsername') THEN
        ALTER TABLE "users" ADD COLUMN "telegramUsername" VARCHAR;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lastActiveAt') THEN
        ALTER TABLE "users" ADD COLUMN "lastActiveAt" TIMESTAMP DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'isActive') THEN
        ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
    END IF;
    
    RAISE NOTICE 'Users table updated';
END $$;

-- =====================================================
-- FIX CATEGORIES TABLE
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'nameEn') THEN
        ALTER TABLE "categories" ADD COLUMN "nameEn" VARCHAR;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'nameRu') THEN
        ALTER TABLE "categories" ADD COLUMN "nameRu" VARCHAR;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'group') THEN
        ALTER TABLE "categories" ADD COLUMN "group" VARCHAR DEFAULT 'other';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'difficultyLevels') THEN
        ALTER TABLE "categories" ADD COLUMN "difficultyLevels" TEXT DEFAULT 'Oson,Orta,Qiyin';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'order') THEN
        ALTER TABLE "categories" ADD COLUMN "order" INTEGER DEFAULT 0;
    END IF;
    
    RAISE NOTICE 'Categories table updated';
END $$;

-- =====================================================
-- FIX ZIKRS TABLE
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zikrs' AND column_name = 'titleArabic') THEN
        ALTER TABLE "zikrs" ADD COLUMN "titleArabic" VARCHAR;
        UPDATE "zikrs" SET "titleArabic" = COALESCE("arabicText", "name") WHERE "titleArabic" IS NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zikrs' AND column_name = 'titleLatin') THEN
        ALTER TABLE "zikrs" ADD COLUMN "titleLatin" VARCHAR;
        UPDATE "zikrs" SET "titleLatin" = "name" WHERE "titleLatin" IS NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zikrs' AND column_name = 'textArabic') THEN
        ALTER TABLE "zikrs" ADD COLUMN "textArabic" TEXT;
        UPDATE "zikrs" SET "textArabic" = COALESCE("arabicText", '') WHERE "textArabic" IS NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zikrs' AND column_name = 'textLatin') THEN
        ALTER TABLE "zikrs" ADD COLUMN "textLatin" TEXT;
        UPDATE "zikrs" SET "textLatin" = COALESCE("transliteration", '') WHERE "textLatin" IS NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zikrs' AND column_name = 'emoji') THEN
        ALTER TABLE "zikrs" ADD COLUMN "emoji" VARCHAR DEFAULT '📿';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zikrs' AND column_name = 'xpReward') THEN
        ALTER TABLE "zikrs" ADD COLUMN "xpReward" INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zikrs' AND column_name = 'isRamadan') THEN
        ALTER TABLE "zikrs" ADD COLUMN "isRamadan" BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zikrs' AND column_name = 'dayOfWeek') THEN
        ALTER TABLE "zikrs" ADD COLUMN "dayOfWeek" INTEGER DEFAULT 0;
    END IF;
    
    RAISE NOTICE 'Zikrs table updated';
END $$;

-- =====================================================
-- FIX ZIKR_COMPLETIONS TABLE
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zikr_completions' AND column_name = 'xpEarned') THEN
        ALTER TABLE "zikr_completions" ADD COLUMN "xpEarned" INTEGER DEFAULT 0;
    END IF;
    
    RAISE NOTICE 'Zikr completions table updated';
END $$;

-- =====================================================
-- CREATE MISSING TABLES (if they don't exist)
-- =====================================================

-- Questions table
CREATE TABLE IF NOT EXISTS "questions" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "categoryId" UUID REFERENCES "categories"("id") ON DELETE CASCADE,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "correctAnswer" INTEGER NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "difficulty" VARCHAR DEFAULT 'MEDIUM',
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Test Attempts table (get users.id type first)
DO $$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    IF user_id_type = 'uuid' THEN
        CREATE TABLE IF NOT EXISTS "test_attempts" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
            "categoryId" UUID REFERENCES "categories"("id") ON DELETE SET NULL,
            "score" INTEGER DEFAULT 0,
            "totalQuestions" INTEGER DEFAULT 0,
            "correctAnswers" INTEGER DEFAULT 0,
            "xpEarned" INTEGER DEFAULT 0,
            "timeSpent" INTEGER DEFAULT 0,
            "completedAt" TIMESTAMP,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
        );
    ELSE
        CREATE TABLE IF NOT EXISTS "test_attempts" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
            "categoryId" UUID REFERENCES "categories"("id") ON DELETE SET NULL,
            "score" INTEGER DEFAULT 0,
            "totalQuestions" INTEGER DEFAULT 0,
            "correctAnswers" INTEGER DEFAULT 0,
            "xpEarned" INTEGER DEFAULT 0,
            "timeSpent" INTEGER DEFAULT 0,
            "completedAt" TIMESTAMP,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
        );
    END IF;
    
    RAISE NOTICE 'Test attempts table created/updated with userId type: %', user_id_type;
END $$;

-- Test Answers table
CREATE TABLE IF NOT EXISTS "test_answers" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "testAttemptId" UUID REFERENCES "test_attempts"("id") ON DELETE CASCADE,
    "questionId" UUID REFERENCES "questions"("id") ON DELETE SET NULL,
    "selectedAnswer" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "timeSpent" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Category Stats table
DO $$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    IF user_id_type = 'uuid' THEN
        CREATE TABLE IF NOT EXISTS "category_stats" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
            "categoryId" UUID REFERENCES "categories"("id") ON DELETE CASCADE,
            "testsCompleted" INTEGER DEFAULT 0,
            "questionsAnswered" INTEGER DEFAULT 0,
            "correctAnswers" INTEGER DEFAULT 0,
            "xpEarned" INTEGER DEFAULT 0,
            "bestScore" INTEGER DEFAULT 0,
            "lastTestAt" TIMESTAMP,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW(),
            UNIQUE("userId", "categoryId")
        );
    ELSE
        CREATE TABLE IF NOT EXISTS "category_stats" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
            "categoryId" UUID REFERENCES "categories"("id") ON DELETE CASCADE,
            "testsCompleted" INTEGER DEFAULT 0,
            "questionsAnswered" INTEGER DEFAULT 0,
            "correctAnswers" INTEGER DEFAULT 0,
            "xpEarned" INTEGER DEFAULT 0,
            "bestScore" INTEGER DEFAULT 0,
            "lastTestAt" TIMESTAMP,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW(),
            UNIQUE("userId", "categoryId")
        );
    END IF;
END $$;

-- Achievements table
CREATE TABLE IF NOT EXISTS "achievements" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "icon" VARCHAR,
    "type" VARCHAR NOT NULL DEFAULT 'test',
    "requirement" INTEGER DEFAULT 1,
    "xpReward" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- User Achievements table
DO $$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    IF user_id_type = 'uuid' THEN
        CREATE TABLE IF NOT EXISTS "user_achievements" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
            "achievementId" UUID REFERENCES "achievements"("id") ON DELETE CASCADE,
            "unlockedAt" TIMESTAMP DEFAULT NOW(),
            UNIQUE("userId", "achievementId")
        );
    ELSE
        CREATE TABLE IF NOT EXISTS "user_achievements" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
            "achievementId" UUID REFERENCES "achievements"("id") ON DELETE CASCADE,
            "unlockedAt" TIMESTAMP DEFAULT NOW(),
            UNIQUE("userId", "achievementId")
        );
    END IF;
END $$;

-- Notifications table
DO $$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    IF user_id_type = 'uuid' THEN
        CREATE TABLE IF NOT EXISTS "notifications" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
            "type" VARCHAR NOT NULL DEFAULT 'info',
            "title" VARCHAR NOT NULL DEFAULT '',
            "message" TEXT,
            "data" JSONB,
            "isRead" BOOLEAN DEFAULT false,
            "createdAt" TIMESTAMP DEFAULT NOW()
        );
    ELSE
        CREATE TABLE IF NOT EXISTS "notifications" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
            "type" VARCHAR NOT NULL DEFAULT 'info',
            "title" VARCHAR NOT NULL DEFAULT '',
            "message" TEXT,
            "data" JSONB,
            "isRead" BOOLEAN DEFAULT false,
            "createdAt" TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;

-- AI Chats table
DO $$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    IF user_id_type = 'uuid' THEN
        CREATE TABLE IF NOT EXISTS "ai_chats" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
            "categoryId" UUID REFERENCES "categories"("id") ON DELETE SET NULL,
            "message" TEXT NOT NULL,
            "response" TEXT NOT NULL,
            "tokensUsed" INTEGER DEFAULT 0,
            "createdAt" TIMESTAMP DEFAULT NOW()
        );
    ELSE
        CREATE TABLE IF NOT EXISTS "ai_chats" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
            "categoryId" UUID REFERENCES "categories"("id") ON DELETE SET NULL,
            "message" TEXT NOT NULL,
            "response" TEXT NOT NULL,
            "tokensUsed" INTEGER DEFAULT 0,
            "createdAt" TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;

-- Admin Messages table
DO $$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    IF user_id_type = 'uuid' THEN
        CREATE TABLE IF NOT EXISTS "admin_messages" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "adminId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
            "type" VARCHAR NOT NULL DEFAULT 'notification',
            "title" VARCHAR,
            "message" TEXT NOT NULL,
            "recipients" JSONB,
            "sentCount" INTEGER DEFAULT 0,
            "createdAt" TIMESTAMP DEFAULT NOW()
        );
    ELSE
        CREATE TABLE IF NOT EXISTS "admin_messages" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "adminId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
            "type" VARCHAR NOT NULL DEFAULT 'notification',
            "title" VARCHAR,
            "message" TEXT NOT NULL,
            "recipients" JSONB,
            "sentCount" INTEGER DEFAULT 0,
            "createdAt" TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;

-- Settings table
CREATE TABLE IF NOT EXISTS "settings" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "key" VARCHAR NOT NULL UNIQUE,
    "value" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Design Settings table
CREATE TABLE IF NOT EXISTS "design_settings" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "key" VARCHAR NOT NULL UNIQUE,
    "value" TEXT,
    "type" VARCHAR DEFAULT 'string',
    "category" VARCHAR DEFAULT 'general',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Weekly XP table
DO $$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    IF user_id_type = 'uuid' THEN
        CREATE TABLE IF NOT EXISTS "weekly_xp" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
            "xp" INTEGER DEFAULT 0,
            "weekStart" DATE NOT NULL,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            UNIQUE("userId", "weekStart")
        );
    ELSE
        CREATE TABLE IF NOT EXISTS "weekly_xp" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
            "xp" INTEGER DEFAULT 0,
            "weekStart" DATE NOT NULL,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            UNIQUE("userId", "weekStart")
        );
    END IF;
END $$;

-- Monthly XP table
DO $$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    IF user_id_type = 'uuid' THEN
        CREATE TABLE IF NOT EXISTS "monthly_xp" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
            "xp" INTEGER DEFAULT 0,
            "monthStart" DATE NOT NULL,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            UNIQUE("userId", "monthStart")
        );
    ELSE
        CREATE TABLE IF NOT EXISTS "monthly_xp" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
            "xp" INTEGER DEFAULT 0,
            "monthStart" DATE NOT NULL,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            UNIQUE("userId", "monthStart")
        );
    END IF;
END $$;

-- Email Verifications table
DO $$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    IF user_id_type = 'uuid' THEN
        CREATE TABLE IF NOT EXISTS "email_verifications" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
            "email" VARCHAR NOT NULL,
            "code" VARCHAR NOT NULL,
            "expiresAt" TIMESTAMP NOT NULL,
            "createdAt" TIMESTAMP DEFAULT NOW()
        );
    ELSE
        CREATE TABLE IF NOT EXISTS "email_verifications" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
            "email" VARCHAR NOT NULL,
            "code" VARCHAR NOT NULL,
            "expiresAt" TIMESTAMP NOT NULL,
            "createdAt" TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;

-- =====================================================
-- CREATE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS "idx_users_telegram_id" ON "users"("telegramId");
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users"("username");
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");
CREATE INDEX IF NOT EXISTS "idx_categories_slug" ON "categories"("slug");
CREATE INDEX IF NOT EXISTS "idx_categories_group" ON "categories"("group");
CREATE INDEX IF NOT EXISTS "idx_questions_category" ON "questions"("categoryId");
CREATE INDEX IF NOT EXISTS "idx_zikrs_day" ON "zikrs"("dayOfWeek");
CREATE INDEX IF NOT EXISTS "idx_zikrs_active" ON "zikrs"("isActive");

-- =====================================================
-- CREATE ROLE TYPE IF NOT EXISTS
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
        CREATE TYPE users_role_enum AS ENUM ('USER', 'MODERATOR', 'ADMIN');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- DONE
-- =====================================================
SELECT '✅ Complete migration finished successfully!' as result;
