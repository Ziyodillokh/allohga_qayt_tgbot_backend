-- Add missing columns to existing tables

-- Add xpEarned column to zikr_completions if not exists
ALTER TABLE "zikr_completions" ADD COLUMN IF NOT EXISTS "xpEarned" INTEGER DEFAULT 0;

-- Add any other missing columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streak" INTEGER DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" VARCHAR;

-- Add missing columns to zikrs table
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "xpReward" INTEGER DEFAULT 10;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "titleLatin" VARCHAR;
ALTER TABLE "zikrs" ADD COLUMN IF NOT EXISTS "emoji" VARCHAR DEFAULT '📿';

-- Update existing zikrs to have titleLatin from name
UPDATE "zikrs" SET "titleLatin" = "name" WHERE "titleLatin" IS NULL;

SELECT 'Columns added successfully!' as result;
