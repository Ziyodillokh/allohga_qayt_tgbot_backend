import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function exportAllData() {
  console.log('🔄 Ma\'lumotlarni eksport qilish boshlandi...\n');

  try {
    // Kategoriyalarni olish
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    console.log(`📁 ${categories.length} ta kategoriya topildi`);

    // Savollarni olish
    const questions = await prisma.question.findMany({
      include: {
        category: {
          select: { slug: true, name: true }
        }
      },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`❓ ${questions.length} ta savol topildi`);

    // Export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      categories: categories.map(cat => ({
        name: cat.name,
        nameEn: cat.nameEn,
        nameRu: cat.nameRu,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        color: cat.color,
        group: cat.group,
        isActive: cat.isActive,
        difficultyLevels: cat.difficultyLevels,
      })),
      questions: questions.map(q => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        levelIndex: q.levelIndex,
        categorySlug: q.category.slug,
        explanation: q.explanation,
      })),
    };

    // Faylga yozish
    const fileName = `export-data-${Date.now()}.json`;
    fs.writeFileSync(fileName, JSON.stringify(exportData, null, 2));
    console.log(`\n✅ Ma'lumotlar ${fileName} fayliga saqlandi`);

    // Statistika
    console.log('\n📊 Statistika:');
    console.log(`   Kategoriyalar: ${exportData.categories.length}`);
    console.log(`   Savollar: ${exportData.questions.length}`);
    
    // Kategoriya bo'yicha savol sonlari
    const catStats: Record<string, number> = {};
    for (const q of questions) {
      const slug = q.category.slug;
      catStats[slug] = (catStats[slug] || 0) + 1;
    }
    
    console.log('\n📁 Kategoriyalar bo\'yicha:');
    Object.entries(catStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([slug, count]) => {
        console.log(`   ${slug}: ${count} ta savol`);
      });

  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportAllData();
