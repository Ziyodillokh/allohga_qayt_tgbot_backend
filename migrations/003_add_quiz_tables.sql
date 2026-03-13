-- Quiz Questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "questionText" TEXT NOT NULL,
    "optionA" VARCHAR(500) NOT NULL,
    "optionB" VARCHAR(500) NOT NULL,
    "optionC" VARCHAR(500) NOT NULL,
    "optionD" VARCHAR(500) NOT NULL,
    "correctOption" VARCHAR(1) NOT NULL CHECK ("correctOption" IN ('a', 'b', 'c', 'd')),
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Quiz Sessions table
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "chatId" BIGINT NOT NULL,
    "totalQuestions" INT NOT NULL,
    "startedAt" TIMESTAMP DEFAULT NOW(),
    "finishedAt" TIMESTAMP
);

-- Quiz Answers table
CREATE TABLE IF NOT EXISTS quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "quizSessionId" UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    "questionId" UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    "userId" BIGINT NOT NULL,
    username VARCHAR(255),
    "selectedOption" VARCHAR(1) NOT NULL CHECK ("selectedOption" IN ('a', 'b', 'c', 'd')),
    "isCorrect" BOOLEAN NOT NULL DEFAULT FALSE,
    "responseTime" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quiz_answers_session ON quiz_answers("quizSessionId");
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question ON quiz_answers("questionId");
CREATE INDEX IF NOT EXISTS idx_quiz_answers_user ON quiz_answers("userId");
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_chat ON quiz_sessions("chatId");

-- Unique constraint: one answer per user per question per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_answers_unique
    ON quiz_answers("quizSessionId", "questionId", "userId");
