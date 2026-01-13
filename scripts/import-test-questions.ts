import { PrismaClient, Difficulty } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ParsedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

function parseQuestions(content: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const lines = content.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Check if line starts with a number followed by a period (question number)
    const questionMatch = line.match(/^\d+\.\s+(.+)$/);
    if (questionMatch) {
      const question = questionMatch[1];
      const options: string[] = [];
      let correctAnswerLetter = '';
      let j = i + 1;
      
      // Skip empty lines after question
      while (j < lines.length && !lines[j].trim()) {
        j++;
      }
      
      // Collect options (both uppercase A-D and lowercase a-d)
      while (j < lines.length && lines[j].trim().match(/^[A-Da-d]\)/)) {
        const option = lines[j].trim().replace(/^[A-Da-d]\)\s*/, '');
        options.push(option);
        j++;
      }
      
      // Skip empty lines before answer
      while (j < lines.length && !lines[j].trim()) {
        j++;
      }
      
      // Find the answer
      if (j < lines.length) {
        const answerLine = lines[j].trim();
        if (answerLine.toLowerCase().includes('javob')) {
          // Match: Javob: a, Javob: b, etc. (case insensitive)
          const answerMatch = answerLine.match(/[Jjavob|JAVOB][^:]*:\s*([A-Da-d])/i);
          if (answerMatch) {
            correctAnswerLetter = answerMatch[1].toUpperCase();
          }
        }
      }
      
      // Convert letter to index (A=0, B=1, C=2, D=3)
      const correctAnswer = correctAnswerLetter.charCodeAt(0) - 65;
      
      if (options.length === 4 && correctAnswer >= 0 && correctAnswer <= 3) {
        questions.push({
          question,
          options,
          correctAnswer,
        });
      }
      
      i = j + 1;
    } else {
      i++;
    }
  }
  
  return questions;
}

function getDifficultyFromFilename(filename: string): Difficulty {
  if (filename.includes('qiyin')) return 'HARD';
  if (filename.includes('ortacha')) return 'MEDIUM';
  if (filename.includes('oson')) return 'EASY';
  return 'EASY';
}

function getCategorySlugFromPath(filePath: string): string {
  const parts = filePath.split(path.sep);
  const categoryFolder = parts[parts.length - 1]; // Last part should be folder name
  
  // Map folder names to category slugs
  const slugMap: { [key: string]: string } = {
    'python': 'python',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'java': 'java',
    'cpp': 'cpp',
    'go': 'golang',
    'rust': 'rust',
    'react': 'react',
    'next': 'nextjs',
    'vue': 'vuejs',
    'html and css': 'html-css',
    'tailwind css': 'tailwind',
    'nodejs': 'nodejs',
    'nestjs': 'nestjs',
    'express.js': 'expressjs',
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
    'ingliz tili': 'english',
    'tarix': 'tarix',
  };
  
  const slug = slugMap[categoryFolder] || categoryFolder.toLowerCase().replace(/\s+/g, '-');
  console.log(`  🔍 Slug mapping: ${categoryFolder} -> ${slug}`);
  return slug;
}

async function importQuestionsFromFolder(folderPath: string) {
  try {
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.txt'));
    const categorySlug = getCategorySlugFromPath(folderPath);
    
    // Get category from database
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });
    
    if (!category) {
      console.log(`❌ Kategoriya topilmadi: ${categorySlug}`);
      return;
    }
    
    console.log(`📂 ${categorySlug} kategoriyasidan savollar import qilinmoqda...`);
    
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const difficulty = getDifficultyFromFilename(file);
      const parsedQuestions = parseQuestions(content);
      
      console.log(`  📄 ${file} - ${parsedQuestions.length} ta savol (${difficulty})`);
      
      let createdCount = 0;
      for (const q of parsedQuestions) {
        // Check if question already exists
        const existingQuestion = await prisma.question.findFirst({
          where: {
            categoryId: category.id,
            question: q.question,
          },
        });
        
        if (!existingQuestion) {
          await prisma.question.create({
            data: {
              categoryId: category.id,
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              difficulty,
              isActive: true,
            },
          });
          createdCount++;
        }
      }
      
      console.log(`    ✅ ${createdCount} ta yangi savol qo'shildi`);
    }
  } catch (error) {
    console.error(`Error importing from ${folderPath}:`, error);
  }
}

async function main() {
  console.log('🚀 Test savollarini import qilish boshlandi...\n');
  
  const testQuestionPath = path.join(__dirname, '../../frontend/test.question');
  console.log('📁 Path:', testQuestionPath);
  console.log('📁 Path mavjudmi?', fs.existsSync(testQuestionPath));
  
  // Get all category folders
  const folders = fs.readdirSync(testQuestionPath).filter(f => {
    const fullPath = path.join(testQuestionPath, f);
    return fs.statSync(fullPath).isDirectory();
  });
  
  console.log(`📂 ${folders.length} ta kategoriya topildi\n`);
  
  for (const folder of folders) {
    const folderPath = path.join(testQuestionPath, folder);
    await importQuestionsFromFolder(folderPath);
  }
  
  console.log('\n✅ Import jarayoni tugadi!');
}

main()
  .catch((e) => {
    console.error('❌ Xato:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
