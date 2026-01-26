-- Fix tables - users.id is TEXT type, not UUID
-- First, let's check and create missing tables with correct types

-- Test Attempts table (userId is TEXT to match users.id)
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

-- Test Answers table
CREATE TABLE IF NOT EXISTS "test_answers" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "testAttemptId" UUID REFERENCES "test_attempts"("id") ON DELETE CASCADE,
    "questionId" UUID REFERENCES "questions"("id") ON DELETE SET NULL,
    "selectedAnswer" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpent" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Category Stats table (userId is TEXT)
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

-- User Achievements table (userId is TEXT)
CREATE TABLE IF NOT EXISTS "user_achievements" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
    "achievementId" UUID REFERENCES "achievements"("id") ON DELETE CASCADE,
    "unlockedAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("userId", "achievementId")
);

-- Notifications table (userId is TEXT)
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
    "type" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "message" TEXT,
    "data" JSONB,
    "isRead" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- AI Chats table (userId is TEXT)
CREATE TABLE IF NOT EXISTS "ai_chats" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
    "message" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "tokensUsed" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Admin Messages table (adminId is TEXT)
CREATE TABLE IF NOT EXISTS "admin_messages" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "adminId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
    "type" VARCHAR NOT NULL,
    "title" VARCHAR,
    "message" TEXT NOT NULL,
    "recipients" JSONB,
    "sentCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Weekly XP table (userId is TEXT)
CREATE TABLE IF NOT EXISTS "weekly_xp" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
    "xp" INTEGER DEFAULT 0,
    "weekStart" DATE NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("userId", "weekStart")
);

-- Monthly XP table (userId is TEXT)
CREATE TABLE IF NOT EXISTS "monthly_xp" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
    "xp" INTEGER DEFAULT 0,
    "monthStart" DATE NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("userId", "monthStart")
);

-- Email Verifications table (userId is TEXT)
CREATE TABLE IF NOT EXISTS "email_verifications" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
    "email" VARCHAR NOT NULL,
    "code" VARCHAR NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Zikr Completions table (userId is TEXT)
CREATE TABLE IF NOT EXISTS "zikr_completions" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
    "zikrId" UUID REFERENCES "zikrs"("id") ON DELETE CASCADE,
    "completedAt" DATE NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("userId", "zikrId", "completedAt")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_test_attempts_user" ON "test_attempts"("userId");
CREATE INDEX IF NOT EXISTS "idx_test_attempts_category" ON "test_attempts"("categoryId");
CREATE INDEX IF NOT EXISTS "idx_test_answers_attempt" ON "test_answers"("testAttemptId");
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications"("userId");
CREATE INDEX IF NOT EXISTS "idx_ai_chats_user" ON "ai_chats"("userId");
CREATE INDEX IF NOT EXISTS "idx_zikr_completions_user" ON "zikr_completions"("userId");
CREATE INDEX IF NOT EXISTS "idx_category_stats_user" ON "category_stats"("userId");
CREATE INDEX IF NOT EXISTS "idx_weekly_xp_user" ON "weekly_xp"("userId");
CREATE INDEX IF NOT EXISTS "idx_monthly_xp_user" ON "monthly_xp"("userId");

SELECT 'All missing tables created successfully!' as result;
