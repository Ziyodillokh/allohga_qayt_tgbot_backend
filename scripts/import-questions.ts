import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ParsedQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // 0-3 (A-D)
}

// Category slug mapping to folder names
const categoryFolderMap: Record<string, string> = {
  'python': 'python',
  'javascript': 'javascript',
  'typescript': 'typescript',
  'java': 'java',
  'cpp': 'cpp',
  'golang': 'go',
  'rust': 'rust',
  'react': 'react',
  'nextjs': 'next',
  'vuejs': 'vue',
  'html-css': 'html and css',
  'tailwind': 'tailwind css',
  'nodejs': 'nodejs',
  'nestjs': 'nestjs',
  'expressjs': 'express.js',
  'django': 'django',
  'sql': 'sql',
  'postgresql': 'postgresql',
  'mongodb': 'mongodb',
  'redis': 'redis',
  'docker': 'docker',
  'git': 'git',
  'linux': 'linux',
  'matematika': 'matematika',
  'fizika': 'fizika',
  'english': 'ingliz tili',
  'tarix': 'tarix',
};

function parseQuestionFile(filePath: string): ParsedQuestion[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const questions: ParsedQuestion[] = [];
  
  // Check for pipe-separated format first: "Question A) Opt1 B) Opt2 C) Opt3 D) Opt4 | Javob: A"
  // Don't require starting with number - some files don't have question numbers
  const pipeFormatLines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && 
           trimmed.includes('|') && 
           trimmed.includes('Javob:') &&
           trimmed.match(/[A-Da-d]\)/); // Must have at least one option marker
  });
  
  if (pipeFormatLines.length > 0) {
    // Parse pipe-separated format: "Question? A) Opt1 B) Opt2 C) Opt3 D) Opt4 | Javob: X"
    console.log(`   Found ${pipeFormatLines.length} lines with pipe format`);
    
    for (const line of pipeFormatLines) {
      const parts = line.split('|');
      if (parts.length !== 2) {
        console.log(`   Skipped line (parts=${parts.length}): ${line.substring(0, 50)}...`);
        continue;
      }
      
      const questionPart = parts[0].trim();
      const answerPart = parts[1].trim();
      
      // Extract question text - improved pattern to handle various formats
      // Matches: "1. Question?", "Question text A) ...", or just "Question?"
      let questionText = questionPart;
      
      // Try to extract question before first option
      const beforeFirstOption = questionPart.match(/^(.+?)\s+[A-Da-d]\)/);
      if (beforeFirstOption) {
        questionText = beforeFirstOption[1].trim();
        // Remove leading number if present: "1. " or "1-25: Header"
        questionText = questionText.replace(/^\d+[\.\-:]\s*/, '');
      }
      
      // Skip header lines (short lines with colons like "1-25: Section Title")
      if (questionText.includes(':') && questionText.split(' ').length < 4) {
        console.log(`   Skipped header: ${questionText}`);
        continue;
      }
      
      const question = questionText.trim();
      if (!question || question.length < 5) {
        console.log(`   Skipped short question: ${question}`);
        continue;
      }
      
      // Extract options - support both uppercase and lowercase
      const options: string[] = [];
      const optionRegex = /([A-Da-d])\)\s+([^A-Da-d|]+?)(?=\s+[A-Da-d]\)|$)/g;
      const optionMatches = questionPart.matchAll(optionRegex);
      for (const match of optionMatches) {
        options.push(match[2].trim());
      }
      
      if (options.length !== 4) {
        if (pipeFormatLines.indexOf(line) < 3) { // Only log first 3
          console.log(`   Wrong option count (${options.length}): ${questionPart.substring(0, 80)}...`);
        }
        continue;
      }
      
      // Extract correct answer - case insensitive
      const answerMatch = answerPart.match(/Javob:\s*([A-Da-d])/i);
      if (!answerMatch) {
        console.log(`   No answer found in: ${answerPart}`);
        continue;
      }
      const answerLetter = answerMatch[1].toUpperCase();
      const correctAnswer = answerLetter.charCodeAt(0) - 'A'.charCodeAt(0);
      
      questions.push({ question, options, correctAnswer });
    }
    
    return questions;
  }
  
  // Original format: multi-line questions
  const questionBlocks = content.split(/\n(?=\*?\*?\d+\.?\*?\*?[\s*])/);
  
  for (const block of questionBlocks) {
    const lines = block.trim().split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && 
             !trimmed.match(/^[=#-]+$/) && 
             !trimmed.startsWith('#') && 
             !trimmed.startsWith('##') &&
             !trimmed.toUpperCase().includes('TESTLAR') &&
             !trimmed.toUpperCase().includes('SAVOL');
    });
    
    if (lines.length < 6) continue; // Skip invalid blocks
    
    // Parse question - support multiple formats
    let questionLine = lines[0].trim();
    let questionMatch = questionLine.match(/^\*?\*?(\d+)\.?\*?\*?\s+(.+)$/);
    if (!questionMatch) continue;
    
    const question = questionMatch[2];
    const options: string[] = [];
    let correctAnswer = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse options - support both uppercase and lowercase
      // "A) Option", "a) Option", "- A) Option", "   A) Option"
      const optionMatch = line.match(/^-?\s*([A-Da-d])\)\s+(.+)$/);
      if (optionMatch) {
        options.push(optionMatch[2]);
        continue;
      }
      
      // Parse correct answer - support both cases
      // "Javob: A", "Javob: a", "**Javob: A**", "Javob: A)"
      const answerMatch = line.match(/\*?\*?Javob:\s*([A-Da-d])\)?\*?\*?/i);
      if (answerMatch) {
        const answerLetter = answerMatch[1].toUpperCase();
        correctAnswer = answerLetter.charCodeAt(0) - 'A'.charCodeAt(0);
        break;
      }
    }
    
    if (question && options.length === 4 && correctAnswer >= 0 && correctAnswer <= 3) {
      questions.push({ question, options, correctAnswer });
    }
  }
  
  return questions;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function importQuestions() {
  console.log('🚀 Starting question import...\n');
  
  const questionsBasePath = path.join(__dirname, '../../frontend/test.question');
  const categories = await prisma.category.findMany();
  
  let totalImported = 0;
  
  for (const category of categories) {
    const folderName = categoryFolderMap[category.slug];
    if (!folderName) {
      console.log(`⚠️ Skipping ${category.name} - no folder mapping`);
      continue;
    }
    
    const categoryPath = path.join(questionsBasePath, folderName);
    if (!fs.existsSync(categoryPath)) {
      console.log(`⚠️ Skipping ${category.name} - folder not found: ${categoryPath}`);
      continue;
    }
    
    console.log(`📝 Processing ${category.name}...`);
    
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.txt'));
    
    // Parse each difficulty level separately
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const questions = parseQuestionFile(filePath);
      
      if (questions.length === 0) {
        console.log(`   ⚠️ No questions parsed from ${file}`);
        continue;
      }
      
      console.log(`   ✓ Parsed ${questions.length} questions from ${file}`);
      
      // Determine difficulty based on file name
      let difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM';
      if (file.includes('qiyin') || file.toLowerCase().includes('hard')) {
        difficulty = 'HARD';
      } else if (file.includes('oson') || file.toLowerCase().includes('easy')) {
        difficulty = 'EASY';
      } else if (file.includes('ortacha') || file.includes('orta') || file.toLowerCase().includes('medium')) {
        difficulty = 'MEDIUM';
      } else {
        // Default fallback: if no difficulty specified, check existing question counts
        const easyCount = await prisma.question.count({ 
          where: { categoryId: category.id, difficulty: 'EASY' } 
        });
        const mediumCount = await prisma.question.count({ 
          where: { categoryId: category.id, difficulty: 'MEDIUM' } 
        });
        const hardCount = await prisma.question.count({ 
          where: { categoryId: category.id, difficulty: 'HARD' } 
        });
        
        // Assign to the level with fewest questions
        if (easyCount <= mediumCount && easyCount <= hardCount) {
          difficulty = 'EASY';
        } else if (mediumCount <= hardCount) {
          difficulty = 'MEDIUM';
        } else {
          difficulty = 'HARD';
        }
        console.log(`   → Auto-detected as ${difficulty} (E:${easyCount}, M:${mediumCount}, H:${hardCount})`);
      }
      
      // Shuffle and import all questions from this file
      const shuffledQuestions = shuffleArray(questions);
      let importedCount = 0;
      
      for (const q of shuffledQuestions) {
        // Randomize answer position
        const correctIndex = q.correctAnswer;
        const optionsWithIndices = q.options.map((opt, idx) => ({ opt, idx }));
        const shuffledOptions = shuffleArray(optionsWithIndices);
        const newCorrectIndex = shuffledOptions.findIndex(item => item.idx === correctIndex);
        
        await prisma.question.create({
          data: {
            categoryId: category.id,
            question: q.question,
            options: shuffledOptions.map(item => item.opt),
            correctAnswer: newCorrectIndex,
            difficulty: difficulty,
            xpReward: difficulty === 'HARD' ? 15 : difficulty === 'MEDIUM' ? 10 : 5,
            tags: [category.slug],
            explanation: null,
          },
        });
        
        importedCount++;
        totalImported++;
      }
      
      console.log(`   ✅ Imported ${importedCount} ${difficulty} questions from ${file}`);
    }
    
    console.log(`   ✅ Completed ${category.name}\n`);
  }
  
  console.log(`\n✅ Import completed! Total questions imported: ${totalImported}`);
}

importQuestions()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
