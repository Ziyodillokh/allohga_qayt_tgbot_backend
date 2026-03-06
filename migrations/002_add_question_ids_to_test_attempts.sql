-- Migration: Add questionIds column to test_attempts table
-- Date: 2026-03-06
-- Description: Adds questionIds column to store question IDs for test attempts

ALTER TABLE "test_attempts" ADD COLUMN IF NOT EXISTS "questionIds" text NOT NULL DEFAULT '';