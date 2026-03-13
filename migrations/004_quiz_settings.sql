-- Quiz Settings table (single-row config)
CREATE TABLE IF NOT EXISTS quiz_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    "answerTimeSeconds" INTEGER NOT NULL DEFAULT 15,
    "waitTimeSeconds" INTEGER NOT NULL DEFAULT 45,
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO quiz_settings (id, "answerTimeSeconds", "waitTimeSeconds")
VALUES (1, 15, 45)
ON CONFLICT (id) DO NOTHING;

-- Add messageIds column to quiz_sessions for /clean support
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS "messageIds" TEXT DEFAULT '[]';
