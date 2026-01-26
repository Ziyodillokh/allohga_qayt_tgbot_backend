-- Add missing columns to questions table
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "xpReward" INTEGER DEFAULT 1;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "levelIndex" INTEGER DEFAULT 0;

-- Fix options column type if needed (should be TEXT for simple-array)
-- ALTER TABLE "questions" ALTER COLUMN "options" TYPE TEXT USING options::TEXT;

SELECT 'Questions table fixed!' as result;
