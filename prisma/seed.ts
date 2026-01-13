import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ==================== CATEGORIES ====================
  const categories = [
    // Dasturlash tillari
    {
      name: "Python",
      slug: "python",
      description: "Python dasturlash tili",
      icon: "🐍",
      color: "#3776AB",
      order: 1,
    },
    {
      name: "JavaScript",
      slug: "javascript",
      description: "JavaScript dasturlash tili",
      icon: "💛",
      color: "#F7DF1E",
      order: 2,
    },
    {
      name: "TypeScript",
      slug: "typescript",
      description: "TypeScript dasturlash tili",
      icon: "💙",
      color: "#3178C6",
      order: 3,
    },
    {
      name: "Java",
      slug: "java",
      description: "Java dasturlash tili",
      icon: "☕",
      color: "#007396",
      order: 4,
    },
    {
      name: "C++",
      slug: "cpp",
      description: "C++ dasturlash tili",
      icon: "⚡",
      color: "#00599C",
      order: 5,
    },
    {
      name: "Go",
      slug: "golang",
      description: "Go dasturlash tili",
      icon: "🔵",
      color: "#00ADD8",
      order: 6,
    },
    {
      name: "Rust",
      slug: "rust",
      description: "Rust dasturlash tili",
      icon: "🦀",
      color: "#DEA584",
      order: 7,
    },

    // Frontend
    {
      name: "React",
      slug: "react",
      description: "React JavaScript kutubxonasi",
      icon: "⚛️",
      color: "#61DAFB",
      order: 10,
    },
    {
      name: "Next.js",
      slug: "nextjs",
      description: "Next.js React framework",
      icon: "▲",
      color: "#000000",
      order: 11,
    },
    {
      name: "Vue.js",
      slug: "vuejs",
      description: "Vue.js framework",
      icon: "💚",
      color: "#4FC08D",
      order: 12,
    },
    {
      name: "HTML/CSS",
      slug: "html-css",
      description: "HTML va CSS asoslari",
      icon: "🎨",
      color: "#E34F26",
      order: 13,
    },
    {
      name: "Tailwind CSS",
      slug: "tailwind",
      description: "Tailwind CSS framework",
      icon: "🌊",
      color: "#06B6D4",
      order: 14,
    },

    // Backend
    {
      name: "Node.js",
      slug: "nodejs",
      description: "Node.js runtime",
      icon: "💚",
      color: "#339933",
      order: 20,
    },
    {
      name: "NestJS",
      slug: "nestjs",
      description: "NestJS framework",
      icon: "🐈",
      color: "#E0234E",
      order: 21,
    },
    {
      name: "Express.js",
      slug: "expressjs",
      description: "Express.js framework",
      icon: "🚂",
      color: "#000000",
      order: 22,
    },
    {
      name: "Django",
      slug: "django",
      description: "Django Python framework",
      icon: "🌿",
      color: "#092E20",
      order: 23,
    },

    // Database
    {
      name: "SQL",
      slug: "sql",
      description: "SQL so'rovlar tili",
      icon: "🗃️",
      color: "#4479A1",
      order: 30,
    },
    {
      name: "PostgreSQL",
      slug: "postgresql",
      description: "PostgreSQL database",
      icon: "🐘",
      color: "#336791",
      order: 31,
    },
    {
      name: "MongoDB",
      slug: "mongodb",
      description: "MongoDB NoSQL database",
      icon: "🍃",
      color: "#47A248",
      order: 32,
    },
    {
      name: "Redis",
      slug: "redis",
      description: "Redis cache database",
      icon: "🔴",
      color: "#DC382D",
      order: 33,
    },

    // DevOps
    {
      name: "Docker",
      slug: "docker",
      description: "Docker containerization",
      icon: "🐳",
      color: "#2496ED",
      order: 40,
    },
    {
      name: "Git",
      slug: "git",
      description: "Git version control",
      icon: "📦",
      color: "#F05032",
      order: 41,
    },
    {
      name: "Linux",
      slug: "linux",
      description: "Linux operatsion tizimi",
      icon: "🐧",
      color: "#FCC624",
      order: 42,
    },

    // Fanlar
    {
      name: "Matematika",
      slug: "matematika",
      description: "Umumiy matematika",
      icon: "🔢",
      color: "#9C27B0",
      order: 50,
    },
    {
      name: "Fizika",
      slug: "fizika",
      description: "Fizika fani",
      icon: "⚛️",
      color: "#2196F3",
      order: 51,
    },
    {
      name: "Ingliz tili",
      slug: "english",
      description: "Ingliz tili grammatikasi",
      icon: "🇬🇧",
      color: "#FF5722",
      order: 52,
    },
    {
      name: "Tarix",
      slug: "tarix",
      description: "Jahon va O'zbekiston tarixi",
      icon: "📜",
      color: "#795548",
      order: 53,
    },
  ];

  console.log("📁 Creating categories...");
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: { ...cat, isActive: true },
    });
  }

  // ==================== ACHIEVEMENTS ====================
  const achievements = [
    // Boshlang'ich
    {
      name: "Birinchi qadam",
      description: "Birinchi testni topshiring",
      icon: "🎯",
      condition: { type: "tests", value: 1 },
      xpReward: 50,
      order: 1,
    },
    {
      name: "Faol o'quvchi",
      description: "10 ta test topshiring",
      icon: "📚",
      condition: { type: "tests", value: 10 },
      xpReward: 100,
      order: 2,
    },
    {
      name: "Tajribali",
      description: "50 ta test topshiring",
      icon: "🏆",
      condition: { type: "tests", value: 50 },
      xpReward: 250,
      order: 3,
    },
    {
      name: "Professional",
      description: "100 ta test topshiring",
      icon: "👑",
      condition: { type: "tests", value: 100 },
      xpReward: 500,
      order: 4,
    },
    {
      name: "Usta",
      description: "500 ta test topshiring",
      icon: "🌟",
      condition: { type: "tests", value: 500 },
      xpReward: 1000,
      order: 5,
    },

    // XP bo'yicha
    {
      name: "Yangi boshlovchi",
      description: "1000 XP to'plang",
      icon: "🌱",
      condition: { type: "xp", value: 1000 },
      xpReward: 100,
      order: 10,
    },
    {
      name: "O'sish",
      description: "5000 XP to'plang",
      icon: "🌿",
      condition: { type: "xp", value: 5000 },
      xpReward: 250,
      order: 11,
    },
    {
      name: "Kuchli",
      description: "10000 XP to'plang",
      icon: "💪",
      condition: { type: "xp", value: 10000 },
      xpReward: 500,
      order: 12,
    },
    {
      name: "Ekspert",
      description: "50000 XP to'plang",
      icon: "🏅",
      condition: { type: "xp", value: 50000 },
      xpReward: 1000,
      order: 13,
    },

    // Level bo'yicha
    {
      name: "Level 5",
      description: "5-levelga yeting",
      icon: "⭐",
      condition: { type: "level", value: 5 },
      xpReward: 100,
      order: 20,
    },
    {
      name: "Level 10",
      description: "10-levelga yeting",
      icon: "🌟",
      condition: { type: "level", value: 10 },
      xpReward: 250,
      order: 21,
    },
    {
      name: "Level 25",
      description: "25-levelga yeting",
      icon: "💫",
      condition: { type: "level", value: 25 },
      xpReward: 500,
      order: 22,
    },

    // Mukammallik
    {
      name: "Mukammal!",
      description: "Testda 100% natija oling",
      icon: "💯",
      condition: { type: "perfect", value: 1 },
      xpReward: 50,
      order: 30,
    },
    {
      name: "Doimiy mukammallik",
      description: "10 ta testda 100% natija oling",
      icon: "🎖️",
      condition: { type: "perfect", value: 10 },
      xpReward: 300,
      order: 31,
    },

    // AI
    {
      name: "AI do'sti",
      description: "AI bilan 10 ta savol-javob",
      icon: "🤖",
      condition: { type: "ai", value: 10 },
      xpReward: 50,
      order: 40,
    },
    {
      name: "AI ustasi",
      description: "AI bilan 100 ta savol-javob",
      icon: "🧠",
      condition: { type: "ai", value: 100 },
      xpReward: 200,
      order: 41,
    },

    // Reyting
    {
      name: "Top 10",
      description: "Reytingda Top 10 ga kiring",
      icon: "🏆",
      condition: { type: "rank", value: 10 },
      xpReward: 500,
      order: 50,
    },
    {
      name: "Yetakchi",
      description: "Reytingda 1-o'rinni egallang",
      icon: "👑",
      condition: { type: "rank", value: 1 },
      xpReward: 1000,
      order: 51,
    },

    // Kategoriya
    {
      name: "Kategoriya ustasi",
      description: "Bitta kategoriyada 50 ta test",
      icon: "🎓",
      condition: { type: "category", value: 50 },
      xpReward: 300,
      order: 60,
    },
    {
      name: "Ko'p qirrali",
      description: "10 ta turli kategoriyada test topshiring",
      icon: "🔮",
      condition: { type: "categories", value: 10 },
      xpReward: 200,
      order: 61,
    },
  ];

  console.log("🏆 Creating achievements...");
  for (const ach of achievements) {
    // Check if achievement exists
    const existing = await prisma.achievement.findFirst({
      where: { name: ach.name },
    });

    if (existing) {
      await prisma.achievement.update({
        where: { id: existing.id },
        data: ach,
      });
    } else {
      await prisma.achievement.create({
        data: { ...ach, isActive: true },
      });
    }
  }
}
