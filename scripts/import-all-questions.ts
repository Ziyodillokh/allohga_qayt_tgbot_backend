import { PrismaClient, Difficulty } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Category name to slug mapping
const categoryMap: Record<string, string> = {
  'cpp': 'cpp',
  'django': 'django',
  'docker': 'docker',
  'express.js': 'expressjs',
  'fizika': 'fizika',
  'git': 'git',
  'go': 'go',
  'html and css': 'html-css',
  'ingliz tili': 'ingliz-tili',
  'java': 'java',
  'javascript': 'javascript',
  'linux': 'linux',
  'matematika': 'matematika',
  'mongodb': 'mongodb',
  'nestjs': 'nestjs',
  'next': 'nextjs',
  'nodejs': 'nodejs',
  'postgresql': 'postgresql',
  'python': 'python',
  'react': 'react',
  'redis': 'redis',
  'rust': 'rust',
  'sql': 'sql',
  'tailwind css': 'tailwindcss',
  'tarix': 'tarix',
  'typescript': 'typescript',
  'vue': 'vuejs',
};

// Category display names
const categoryNames: Record<string, string> = {
  'cpp': 'C++',
  'django': 'Django',
  'docker': 'Docker',
  'expressjs': 'Express.js',
  'fizika': 'Fizika',
  'git': 'Git',
  'go': 'Go',
  'html-css': 'HTML & CSS',
  'ingliz-tili': 'Ingliz tili',
  'java': 'Java',
  'javascript': 'JavaScript',
  'linux': 'Linux',
  'matematika': 'Matematika',
  'mongodb': 'MongoDB',
  'nestjs': 'NestJS',
  'nextjs': 'Next.js',
  'nodejs': 'Node.js',
  'postgresql': 'PostgreSQL',
  'python': 'Python',
  'react': 'React',
  'redis': 'Redis',
  'rust': 'Rust',
  'sql': 'SQL',
  'tailwindcss': 'Tailwind CSS',
  'tarix': 'Tarix',
  'typescript': 'TypeScript',
  'vuejs': 'Vue.js',
};

// Category groups
const categoryGroups: Record<string, string> = {
  'cpp': 'programming',
  'django': 'backend',
  'docker': 'devops',
  'expressjs': 'backend',
  'fizika': 'science',
  'git': 'devops',
  'go': 'programming',
  'html-css': 'frontend',
  'ingliz-tili': 'language',
  'java': 'programming',
  'javascript': 'programming',
  'linux': 'devops',
  'matematika': 'science',
  'mongodb': 'database',
  'nestjs': 'backend',
  'nextjs': 'frontend',
  'nodejs': 'backend',
  'postgresql': 'database',
  'python': 'programming',
  'react': 'frontend',
  'redis': 'database',
  'rust': 'programming',
  'sql': 'database',
  'tailwindcss': 'frontend',
  'tarix': 'science',
  'typescript': 'programming',
  'vuejs': 'frontend',
};

// File difficulty mapping
function getDifficulty(filename: string): Difficulty {
  if (filename.includes('oson') || filename.includes('boshlang')) return 'EASY';
  if (filename.includes('ortacha') || filename.includes('orta')) return 'MEDIUM';
  if (filename.includes('qiyin') || filename.includes('expert') || filename.includes('murakkab')) return 'HARD';
  return 'MEDIUM';
}

// Parse questions from file
function parseQuestions(content: string, difficulty: Difficulty): Array<{
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: Difficulty;
}> {
  const questions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    difficulty: Difficulty;
  }> = [];

  // Split by question numbers (1. 2. 3. etc)
  const questionBlocks = content.split(/\n\d+\.\s+/).filter(block => block.trim());

  for (const block of questionBlocks) {
    const lines = block.trim().split('\n').filter(line => line.trim());
    if (lines.length < 5) continue; // Need at least question + 4 options

    // First line is question
    let questionText = lines[0].trim();
    
    // Find options (A, B, C, D)
    const options: string[] = [];
    let correctIndex = 1; // Default to B
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for options
      const optionMatch = line.match(/^([A-D])\)\s*(.+)/);
      if (optionMatch) {
        options.push(optionMatch[2].trim());
      }
      
      // Check for answer
      const answerMatch = line.match(/^Javob:\s*([A-D])/i);
      if (answerMatch) {
        const answerLetter = answerMatch[1].toUpperCase();
        correctIndex = ['A', 'B', 'C', 'D'].indexOf(answerLetter);
      }
    }

    if (options.length >= 4 && questionText) {
      // Randomize correct answer position
      const newCorrectIndex = Math.floor(Math.random() * 4);
      
      if (newCorrectIndex !== correctIndex) {
        // Swap options
        const correctAnswer = options[correctIndex];
        options[correctIndex] = options[newCorrectIndex];
        options[newCorrectIndex] = correctAnswer;
      }

      questions.push({
        question: questionText,
        options: options.slice(0, 4),
        correctIndex: newCorrectIndex,
        difficulty,
      });
    }
  }

  return questions;
}

async function importQuestions() {
  const testQuestionsDir = path.join(__dirname, '../../frontend/test.question');
  
  if (!fs.existsSync(testQuestionsDir)) {
    console.error('test.question directory not found!');
    return;
  }

  const folders = fs.readdirSync(testQuestionsDir);
  let totalImported = 0;
  let totalSkipped = 0;

  for (const folder of folders) {
    const folderPath = path.join(testQuestionsDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const slug = categoryMap[folder];
    if (!slug) {
      console.log(`⚠️  Unknown category: ${folder}, skipping...`);
      continue;
    }

    // Find or create category
    let category = await prisma.category.findUnique({ where: { slug } });
    
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: categoryNames[slug] || folder,
          slug,
          group: categoryGroups[slug] || 'other',
          isActive: true,
        },
      });
      console.log(`✅ Category created: ${category.name}`);
    }

    // Get existing questions for this category to avoid duplicates
    const existingQuestions = await prisma.question.findMany({
      where: { categoryId: category.id },
      select: { question: true },
    });
    const existingSet = new Set(existingQuestions.map(q => q.question.toLowerCase().trim()));

    // Read all txt files in folder
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.txt'));

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const difficulty = getDifficulty(file);
      
      const questions = parseQuestions(content, difficulty);
      
      let fileImported = 0;
      let fileSkipped = 0;

      for (const q of questions) {
        const questionKey = q.question.toLowerCase().trim();
        
        if (existingSet.has(questionKey)) {
          fileSkipped++;
          totalSkipped++;
          continue;
        }

        try {
          await prisma.question.create({
            data: {
              categoryId: category.id,
              question: q.question,
              options: q.options,
              correctAnswer: q.correctIndex,
              difficulty: q.difficulty,
              xpReward: q.difficulty === 'EASY' ? 10 : q.difficulty === 'MEDIUM' ? 20 : 30,
              isActive: true,
            },
          });
          
          existingSet.add(questionKey);
          fileImported++;
          totalImported++;
        } catch (error) {
          console.error(`Error importing question: ${q.question.substring(0, 50)}...`);
        }
      }

      console.log(`  📁 ${file}: ${fileImported} imported, ${fileSkipped} skipped`);
    }

    console.log(`📂 ${folder}: Done`);
  }

  console.log('\n========================================');
  console.log(`✅ Total imported: ${totalImported}`);
  console.log(`⏭️  Total skipped (duplicates): ${totalSkipped}`);
  console.log('========================================');
}

importQuestions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
