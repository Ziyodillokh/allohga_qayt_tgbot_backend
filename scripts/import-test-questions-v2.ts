import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface Question {
  text: string;
  options: string[];
  correctAnswer: number;
}

function parseQuestions(content: string): Question[] {
  const questions: Question[] = [];

  // Normalize line endings - handle both \r\n and \n
  const normalized = content.replace(/\r\n/g, "\n");

  // Split by double newlines (format like Tarix)
  const blocks = normalized.split(/\n\n+/);

  for (const block of blocks) {
    if (!block.trim().length) continue;

    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length < 5) continue; // Need at least: question + 4 options (+ answer line)

    // Find answer line and option lines
    let questionLines: string[] = [];
    let optionLines: string[] = [];
    let answerLine = "";

    for (let i = 0; i < lines.length; i++) {
      if (/^Javob[\s:]*([A-Da-d])/i.test(lines[i].trim())) {
        answerLine = lines[i];
        // Question is everything before the answer
        questionLines = lines.slice(0, i);
        // Options should be just before answer
        break;
      }
    }

    if (!answerLine) {
      // Try without "Javob" prefix - answer might be just a letter on its own line
      if (/^[A-D]$/.test(lines[lines.length - 1].trim())) {
        answerLine = lines[lines.length - 1];
        questionLines = lines.slice(0, -1);
      } else {
        continue;
      }
    }

    // Filter out non-option lines from the end of questionLines
    while (
      questionLines.length > 0 &&
      !/^[\s]*[A-Da-d]\)/.test(questionLines[questionLines.length - 1].trim())
    ) {
      questionLines.pop();
    }

    // Extract options (must be lines starting with A-D followed by ))
    optionLines = [];
    for (let i = questionLines.length - 1; i >= 0; i--) {
      if (/^[\s]*[A-Da-d]\)/.test(questionLines[i].trim())) {
        optionLines.unshift(questionLines[i]);
        if (optionLines.length === 4) break;
      }
    }

    if (optionLines.length < 4) {
      // Try alternative: look for A/B/C/D in exact order
      optionLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^[A-Da-d]\)/.test(line)) {
          optionLines.push(lines[i]);
        }
      }
      if (optionLines.length > 4) {
        optionLines = optionLines.slice(-4);
      }
    }

    if (optionLines.length < 4) continue;

    // Extract question text - everything except options
    const questionText = questionLines
      .slice(0, -4)
      .join(" ")
      .replace(/^[#\*]*\s*\d+[\.\)]?\s*\*+\s*/i, "")
      .replace(/VARIANT.*$/i, "")
      .replace(/DARAJA.*$/i, "")
      .trim();

    if (!questionText || questionText.length < 3) continue;

    // Parse options
    const options = optionLines.map((line) => {
      return line
        .replace(/^[\s]*[A-Da-d]\)[:\s]*/, "")
        .trim();
    });

    // Parse answer
    const answerMatch = answerLine.match(/([A-Da-d])/i);
    if (!answerMatch) continue;

    const answerLetter = answerMatch[1].toUpperCase();
    const answerIndex = answerLetter.charCodeAt(0) - "A".charCodeAt(0);

    if (answerIndex < 0 || answerIndex > 3) continue;

    questions.push({
      text: questionText,
      options,
      correctAnswer: answerIndex,
    });
  }

  return questions;
}

const categoryMapping: { [key: string]: string } = {
  java: "java",
  javascript: "javascript",
  typescript: "typescript",
  react: "react",
  vue: "vuejs",
  python: "python",
  cpp: "cpp",
  go: "golang",
  rust: "rust",
  sql: "sql",
  postgresql: "postgresql",
  mongodb: "mongodb",
  redis: "redis",
  docker: "docker",
  linux: "linux",
  git: "git",
  "html and css": "html-css",
  "html-css": "html-css",
  nodejs: "nodejs",
  "express.js": "expressjs",
  "expressjs": "expressjs",
  nestjs: "nestjs",
  next: "nextjs",
  "nextjs": "nextjs",
  django: "django",
  "tailwind css": "tailwind",
  "tailwindcss": "tailwind",
  matematika: "matematika",
  fizika: "fizika",
  "ingliz tili": "english",
  "ingliztili": "english",
  tarix: "tarix",
};

function getCategorySlugFromPath(folderName: string): string {
  const normalized = folderName.toLowerCase();
  return categoryMapping[normalized] || normalized.replace(/\s+/g, "-");
}

function getDifficultyFromFilename(filename: string): string {
  if (filename.includes("oson") || filename.includes("easy")) return "EASY";
  if (filename.includes("ortacha") || filename.includes("medium"))
    return "MEDIUM";
  if (filename.includes("qiyin") || filename.includes("hard")) return "HARD";
  return "MEDIUM";
}

async function importQuestionsFromFolder(
  folderPath: string,
  categorySlug: string
) {
  try {
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => f.endsWith(".txt"));

    console.log(`\n📂 Processing ${categorySlug}...`);
    console.log(`   Found ${files.length} files`);

    let totalAdded = 0;

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, "utf-8");

      const questions = parseQuestions(content);
      const difficulty = getDifficultyFromFilename(file);

      console.log(
        `   📄 ${file}: parsed ${questions.length} questions (${difficulty})`
      );

      // Get category ID first
      const category = await prisma.category.findUnique({
        where: { slug: categorySlug },
      });

      if (!category) {
        console.log(`   ⚠️  Category not found: ${categorySlug}`);
        continue;
      }

      for (const q of questions) {
        // Check for duplicates
        const existing = await prisma.question.findFirst({
          where: {
            question: q.text,
            categoryId: category.id,
          },
        });

        if (!existing) {
          await prisma.question.create({
            data: {
              question: q.text,
              options: q.options,
              correctAnswer: q.correctAnswer,
              difficulty: difficulty as any,
              categoryId: category.id,
            },
          });
          totalAdded++;
        }
      }
    }

    console.log(`   ✅ Added ${totalAdded} new questions for ${categorySlug}`);
    return totalAdded;
  } catch (error) {
    console.error(`❌ Error processing ${categorySlug}:`, error);
    return 0;
  }
}

async function main() {
  try {
    console.log("🚀 Starting improved question import...\n");

    const testQuestionPath = path.join(
      __dirname,
      "../../frontend/test.question"
    );

    if (!fs.existsSync(testQuestionPath)) {
      console.error(`❌ Path not found: ${testQuestionPath}`);
      return;
    }

    const categories = fs
      .readdirSync(testQuestionPath)
      .filter((f) =>
        fs
          .statSync(path.join(testQuestionPath, f))
          .isDirectory()
      );

    console.log(`Found ${categories.length} categories\n`);

    let grandTotal = 0;

    for (const category of categories) {
      const folderPath = path.join(testQuestionPath, category);
      const categorySlug = getCategorySlugFromPath(category);

      const added = await importQuestionsFromFolder(folderPath, categorySlug);
      grandTotal += added;
    }

    console.log(
      `\n✨ Import complete! Total new questions added: ${grandTotal}`
    );

    // Show final statistics
    const categoriesStats = await prisma.category.findMany({
      select: {
        slug: true,
        _count: {
          select: { questions: true },
        },
      },
    });

    console.log("\n📊 Final statistics:");
    let totalQuestions = 0;
    for (const cat of categoriesStats.sort((a, b) =>
      a.slug.localeCompare(b.slug)
    )) {
      if (cat._count.questions > 0) {
        console.log(`   ${cat.slug}: ${cat._count.questions}`);
        totalQuestions += cat._count.questions;
      }
    }
    console.log(`\n   📈 TOTAL: ${totalQuestions} questions`);
  } catch (error) {
    console.error("Fatal error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
