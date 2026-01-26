UPDATE "User" SET "totalXP" = 1600 WHERE "username" = 'Bekmuhammad';

-- Set all questions xpReward to 1 (1 XP per correct answer)
UPDATE "Question" SET "xpReward" = 1 WHERE "xpReward" != 1;