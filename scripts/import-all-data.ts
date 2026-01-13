import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function importAllData() {
  console.log('🔄 Ma\'lumotlarni import qilish boshlandi...\n');

  // JSON faylni o'qish
  const files = fs.readdirSync('.').filter(f => f.startsWith('export-data-') && f.endsWith('.json'));
  
  if (files.length === 0) {
    console.error('❌ export-data-*.json fayl topilmadi!');
    process.exit(1);
  }

  // Eng so'nggi faylni olish
  const latestFile = files.sort().reverse()[0];
  console.log(`📂 Fayl: ${latestFile}\n`);

  const data = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
  
  console.log(`📊 Import qilinadigan ma'lumotlar:`);
  console.log(`   Kategoriyalar: ${data.categories.length}`);
  console.log(`   Savollar: ${data.questions.length}\n`);

  try {
    // 1. Kategoriyalarni import qilish
    console.log('📁 Kategoriyalar import qilinmoqda...');
    let catCreated = 0;
    let catUpdated = 0;

    for (const cat of data.categories) {
      const existing = await prisma.category.findUnique({
        where: { slug: cat.slug }
      });

      if (existing) {
        await prisma.category.update({
          where: { slug: cat.slug },
          data: {
            name: cat.name,
            nameEn: cat.nameEn,
            nameRu: cat.nameRu,
            description: cat.description,
            icon: cat.icon,
            color: cat.color,
            group: cat.group,
            isActive: cat.isActive ?? true,
            difficultyLevels: cat.difficultyLevels ?? ['Oson', "O'rta", 'Qiyin'],
          }
        });
        catUpdated++;
      } else {
        await prisma.category.create({
          data: {
            name: cat.name,
            nameEn: cat.nameEn,
            nameRu: cat.nameRu,
            slug: cat.slug,
            description: cat.description,
            icon: cat.icon,
            color: cat.color,
            group: cat.group,
            isActive: cat.isActive ?? true,
            difficultyLevels: cat.difficultyLevels ?? ['Oson', "O'rta", 'Qiyin'],
          }
        });
        catCreated++;
      }
    }
    console.log(`   ✅ ${catCreated} ta yangi, ${catUpdated} ta yangilangan\n`);

    // 2. Kategoriya slug -> id mapping
    const categories = await prisma.category.findMany();
    const catMap = new Map(categories.map(c => [c.slug, c.id]));

    // 3. Mavjud savollarni tekshirish (dublikat oldini olish)
    console.log('🔍 Mavjud savollar tekshirilmoqda...');
    const existingQuestions = await prisma.question.findMany({
      select: { question: true, categoryId: true }
    });
    const existingSet = new Set(
      existingQuestions.map(q => `${q.categoryId}::${q.question.substring(0, 100)}`)
    );
    console.log(`   Bazada ${existingQuestions.length} ta savol mavjud\n`);

    // 4. Savollarni import qilish
    console.log('❓ Savollar import qilinmoqda...');
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const q of data.questions) {
      const categoryId = catMap.get(q.categorySlug);
      
      if (!categoryId) {
        console.log(`   ⚠️ Kategoriya topilmadi: ${q.categorySlug}`);
        errors++;
        continue;
      }

      // Dublikat tekshirish
      const key = `${categoryId}::${q.question.substring(0, 100)}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      try {
        await prisma.question.create({
          data: {
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            difficulty: q.difficulty || 'MEDIUM',
            levelIndex: q.levelIndex ?? 0,
            categoryId: categoryId,
            explanation: q.explanation,
          }
        });
        imported++;
        existingSet.add(key);

        // Progress
        if (imported % 500 === 0) {
          console.log(`   ... ${imported} ta savol import qilindi`);
        }
      } catch (error: any) {
        errors++;
        if (errors <= 5) {
          console.log(`   ❌ Xatolik: ${error.message?.substring(0, 50)}`);
        }
      }
    }

    console.log(`\n✅ Import yakunlandi!`);
    console.log(`   Import qilindi: ${imported}`);
    console.log(`   O'tkazib yuborildi (dublikat): ${skipped}`);
    console.log(`   Xatolar: ${errors}`);

    // 5. Statistikani yangilash
    console.log('\n📊 Kategoriya statistikasi yangilanmoqda...');
    for (const cat of categories) {
      const count = await prisma.question.count({
        where: { categoryId: cat.id }
      });
      console.log(`   ${cat.name}: ${count} ta savol`);
    }

  } catch (error) {
    console.error('❌ Import xatosi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importAllData();
