import { DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";

async function seedAdmin() {
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgres://postgres:Ziyodilloh_06@127.0.0.1:5432/tavba";

  const dataSource = new DataSource({
    type: "postgres",
    url: dbUrl,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  await dataSource.initialize();
  console.log("Database connected");

  const username = "Ziyodulloh";
  const password = "tavba_uz";
  const hashedPassword = await bcrypt.hash(password, 12);

  // Tekshirish — allaqachon bormi
  const existing = await dataSource.query(
    `SELECT id, username, role FROM users WHERE username = $1`,
    [username],
  );

  if (existing.length > 0) {
    // Mavjud bo'lsa — role va parolni yangilash
    await dataSource.query(
      `UPDATE users SET password = $1, role = 'ADMIN', "isActive" = true WHERE username = $2`,
      [hashedPassword, username],
    );
    console.log(
      `Admin "${username}" yangilandi (role=ADMIN, parol yangilandi)`,
    );
  } else {
    // Yangi admin yaratish
    await dataSource.query(
      `INSERT INTO users (username, password, "fullName", role, "isActive", "totalXP", level, "testsCompleted", "zikrCount", "lastActiveAt")
       VALUES ($1, $2, $3, 'ADMIN', true, 0, 1, 0, 0, NOW())`,
      [username, hashedPassword, "Ziyodulloh (Admin)"],
    );
    console.log(`Admin "${username}" yaratildi!`);
  }

  console.log(`Login: ${username}`);
  console.log(`Parol: ${password}`);

  await dataSource.destroy();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Xatolik:", err);
  process.exit(1);
});
