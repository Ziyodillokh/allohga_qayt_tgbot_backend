import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ParsedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

// Category slug to folder mapping
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

function parseMultiLineFormat(content: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const lines = content.split('\n');
  
  let currentQuestion = '';
  let currentOptions: string[] = [];
  let currentAnswer = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Skip headers
    if (line.includes('===') || line.includes('---') || 
        line.toUpperCase().includes('TEST') && line.toUpperCase().includes('SAVOL')) {
      continue;
    }
    
    // Check for question line (starts with number)
    const questionMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (questionMatch) {
      // Save previous question if complete
      if (currentQuestion && currentOptions.length === 4 && currentAnswer >= 0) {
        questions.push({
          question: currentQuestion,
          options: currentOptions,
          correctAnswer: currentAnswer
        });
      }
      
      currentQuestion = questionMatch[2];
      currentOptions = [];
      currentAnswer = -1;
      continue;
    }
    
    // Check for option line
    const optionMatch = line.match(/^([A-D])\)\s+(.+)$/i);
    if (optionMatch) {
      currentOptions.push(optionMatch[2]);
      continue;
    }
    
    // Check for answer line
    const answerMatch = line.match(/Javob:\s*([A-D])/i);
    if (answerMatch) {
      currentAnswer = answerMatch[1].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
      continue;
    }
  }
  
  // Save last question
  if (currentQuestion && currentOptions.length === 4 && currentAnswer >= 0) {
    questions.push({
      question: currentQuestion,
      options: currentOptions,
      correctAnswer: currentAnswer
    });
  }
  
  return questions;
}

function parsePipeFormat(content: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('|') || !trimmed.includes('Javob:')) continue;
    
    const parts = trimmed.split('|');
    if (parts.length !== 2) continue;
    
    const questionPart = parts[0].trim();
    const answerPart = parts[1].trim();
    
    // Extract question text
    const questionMatch = questionPart.match(/^(?:\d+\.\s+)?(.+?)\s+[A-D]\)/i);
    if (!questionMatch) continue;
    
    const question = questionMatch[1].trim();
    if (question.length < 5) continue;
    
    // Extract options
    const options: string[] = [];
    const optionMatches = questionPart.matchAll(/([A-D])\)\s+([^A-D]+?)(?=\s+[A-D]\)|$)/gi);
    for (const match of optionMatches) {
      options.push(match[2].trim());
    }
    
    if (options.length !== 4) continue;
    
    // Extract answer
    const answerMatch = answerPart.match(/Javob:\s*([A-D])/i);
    if (!answerMatch) continue;
    
    const correctAnswer = answerMatch[1].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    
    questions.push({ question, options, correctAnswer });
  }
  
  return questions;
}

function parseFile(filePath: string): ParsedQuestion[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Try multi-line format first (more reliable)
  let questions = parseMultiLineFormat(content);
  
  // If no questions found, try pipe format
  if (questions.length === 0) {
    questions = parsePipeFormat(content);
  }
  
  return questions;
}

function getDifficulty(fileName: string): 'EASY' | 'MEDIUM' | 'HARD' {
  const lower = fileName.toLowerCase();
  if (lower.includes('oson') || lower.includes('easy')) return 'EASY';
  if (lower.includes('qiyin') || lower.includes('hard')) return 'HARD';
  if (lower.includes('expert')) return 'HARD';
  return 'MEDIUM';
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function importAllUnique() {
  console.log('🗑️ Deleting all existing questions...');
  await prisma.question.deleteMany();
  console.log('✅ All questions deleted\n');
  
  const questionsBasePath = path.join(__dirname, '../../frontend/test.question');
  const categories = await prisma.category.findMany();
  
  let totalImported = 0;
  const results: { name: string; count: number }[] = [];
  
  for (const category of categories) {
    const folderName = categoryFolderMap[category.slug];
    if (!folderName) {
      console.log(`⚠️ No folder mapping for ${category.name} (${category.slug})`);
      continue;
    }
    
    const categoryPath = path.join(questionsBasePath, folderName);
    if (!fs.existsSync(categoryPath)) {
      console.log(`⚠️ Folder not found: ${categoryPath}`);
      continue;
    }
    
    console.log(`\n📝 Processing ${category.name}...`);
    
    // Collect all unique questions from all files
    const allQuestions: Map<string, { q: ParsedQuestion; difficulty: 'EASY' | 'MEDIUM' | 'HARD' }> = new Map();
    
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.txt'));
    
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const questions = parseFile(filePath);
      const difficulty = getDifficulty(file);
      
      console.log(`   📄 ${file}: ${questions.length} questions (${difficulty})`);
      
      for (const q of questions) {
        // Use question text as unique key (normalized)
        const key = q.question.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!allQuestions.has(key)) {
          allQuestions.set(key, { q, difficulty });
        }
      }
    }
    
    console.log(`   📊 Total unique questions: ${allQuestions.size}`);
    
    // Convert to array and shuffle
    const uniqueQuestions = Array.from(allQuestions.values());
    const shuffled = shuffleArray(uniqueQuestions);
    
    // Take up to 400 questions
    const toImport = shuffled.slice(0, 400);
    
    // Import questions
    let imported = 0;
    for (const { q, difficulty } of toImport) {
      // Shuffle options
      const optionsWithIndex = q.options.map((opt, idx) => ({ opt, idx }));
      const shuffledOptions = shuffleArray(optionsWithIndex);
      const newCorrectIndex = shuffledOptions.findIndex(item => item.idx === q.correctAnswer);
      
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
      
      imported++;
    }
    
    console.log(`   ✅ Imported ${imported} unique questions`);
    results.push({ name: category.name, count: imported });
    totalImported += imported;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 IMPORT RESULTS:');
  console.log('='.repeat(50));
  
  for (const r of results.sort((a, b) => b.count - a.count)) {
    console.log(`   ${r.name}: ${r.count}`);
  }
  
  console.log('='.repeat(50));
  console.log(`✅ TOTAL IMPORTED: ${totalImported} unique questions`);
}

importAllUnique()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
