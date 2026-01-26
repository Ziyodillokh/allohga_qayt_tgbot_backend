-- UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "telegramId" VARCHAR UNIQUE,
    "username" VARCHAR UNIQUE,
    "email" VARCHAR UNIQUE,
    "password" VARCHAR,
    "firstName" VARCHAR,
    "lastName" VARCHAR,
    "avatar" VARCHAR,
    "role" VARCHAR DEFAULT 'USER',
    "xp" INTEGER DEFAULT 0,
    "level" INTEGER DEFAULT 1,
    "streak" INTEGER DEFAULT 0,
    "lastActiveAt" TIMESTAMP,
    "isBlocked" BOOLEAN DEFAULT false,
    "isEmailVerified" BOOLEAN DEFAULT false,
    "phone" VARCHAR,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS "categories" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR NOT NULL,
    "slug" VARCHAR NOT NULL UNIQUE,
    "description" TEXT,
    "icon" VARCHAR,
    "color" VARCHAR DEFAULT '#D4AF37',
    "isActive" BOOLEAN DEFAULT true,
    "order" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS "questions" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "categoryId" UUID REFERENCES "categories"("id") ON DELETE CASCADE,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" INTEGER NOT NULL,
    "explanation" TEXT,
    "difficulty" VARCHAR DEFAULT 'MEDIUM',
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Test Attempts table
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

-- Category Stats table
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

-- Achievements table
CREATE TABLE IF NOT EXISTS "achievements" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "icon" VARCHAR,
    "type" VARCHAR NOT NULL,
    "requirement" INTEGER DEFAULT 1,
    "xpReward" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- User Achievements table
CREATE TABLE IF NOT EXISTS "user_achievements" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
    "achievementId" UUID REFERENCES "achievements"("id") ON DELETE CASCADE,
    "unlockedAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("userId", "achievementId")
);

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
    "type" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "message" TEXT,
    "data" JSONB,
    "isRead" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- AI Chats table
CREATE TABLE IF NOT EXISTS "ai_chats" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
    "message" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "tokensUsed" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Admin Messages table
CREATE TABLE IF NOT EXISTS "admin_messages" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "adminId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "type" VARCHAR NOT NULL,
    "title" VARCHAR,
    "message" TEXT NOT NULL,
    "recipients" JSONB,
    "sentCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

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
CREATE TABLE IF NOT EXISTS "weekly_xp" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
    "xp" INTEGER DEFAULT 0,
    "weekStart" DATE NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("userId", "weekStart")
);

-- Monthly XP table
CREATE TABLE IF NOT EXISTS "monthly_xp" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
    "xp" INTEGER DEFAULT 0,
    "monthStart" DATE NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("userId", "monthStart")
);

-- Email Verifications table
CREATE TABLE IF NOT EXISTS "email_verifications" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
    "email" VARCHAR NOT NULL,
    "code" VARCHAR NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Zikrs table
CREATE TABLE IF NOT EXISTS "zikrs" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR NOT NULL,
    "arabicText" TEXT,
    "translation" TEXT,
    "transliteration" TEXT,
    "count" INTEGER DEFAULT 33,
    "reward" TEXT,
    "dayOfWeek" INTEGER,
    "order" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Zikr Completions table
CREATE TABLE IF NOT EXISTS "zikr_completions" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
    "zikrId" UUID REFERENCES "zikrs"("id") ON DELETE CASCADE,
    "completedAt" DATE NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("userId", "zikrId", "completedAt")
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_users_telegram_id" ON "users"("telegramId");
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users"("username");
CREATE INDEX IF NOT EXISTS "idx_questions_category" ON "questions"("categoryId");
CREATE INDEX IF NOT EXISTS "idx_test_attempts_user" ON "test_attempts"("userId");
CREATE INDEX IF NOT EXISTS "idx_test_attempts_category" ON "test_attempts"("categoryId");
CREATE INDEX IF NOT EXISTS "idx_test_answers_attempt" ON "test_answers"("testAttemptId");
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications"("userId");
CREATE INDEX IF NOT EXISTS "idx_ai_chats_user" ON "ai_chats"("userId");
CREATE INDEX IF NOT EXISTS "idx_zikr_completions_user" ON "zikr_completions"("userId");

-- Insert default categories
INSERT INTO "categories" ("name", "slug", "description", "icon", "color", "order") VALUES
('Aqida', 'aqida', 'Islom e''tiqodi asoslari', '🕌', '#D4AF37', 1),
('Fiqh', 'fiqh', 'Islom huquqi va amaliy masalalar', '📚', '#4A90D9', 2),
('Hadis', 'hadis', 'Payg''ambarimiz hadislari', '📖', '#50C878', 3),
('Qur''on', 'quron', 'Qur''oni Karim haqida', '📗', '#9B59B6', 4),
('Siyrat', 'seerat', 'Payg''ambarimiz hayoti', '🌙', '#E74C3C', 5)
ON CONFLICT ("slug") DO NOTHING;

-- Insert default zikrs
INSERT INTO "zikrs" ("name", "arabicText", "translation", "count", "reward", "dayOfWeek", "order") VALUES
('SubhanAllah', 'سُبْحَانَ اللهِ', 'Alloh barcha nuqsonlardan pokdir', 33, 'Har bir SubhanAllah aytganda bir daraxt ekiladi', NULL, 1),
('Alhamdulillah', 'الْحَمْدُ لِلَّهِ', 'Barcha hamd-u sano Allohga xosdir', 33, 'Mezon tarozisini to''ldiradi', NULL, 2),
('Allahu Akbar', 'اللهُ أَكْبَرُ', 'Alloh eng buyukdir', 33, 'Osmon va erni to''ldiradi', NULL, 3),
('La ilaha illallah', 'لَا إِلَٰهَ إِلَّا اللهُ', 'Allohdan o''zga iloh yo''q', 100, 'Eng afzal zikr', NULL, 4),
('Salavot', 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', 'Allohim, Muhammadga salavot yubor', 100, 'Qiyomat kuni shafaat', NULL, 5)
ON CONFLICT DO NOTHING;

SELECT 'All tables created successfully!' as result;
