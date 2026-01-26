import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";

export enum Role {
  USER = "USER",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
}

@Entity("users")
@Index(["email"])
@Index(["username"])
@Index(["totalXP"])
@Index(["telegramId"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: true, unique: true })
  email: string | null;

  @Column({ type: "varchar", unique: true })
  username: string;

  @Column({ type: "varchar", nullable: true })
  password: string | null;

  @Column({ type: "varchar" })
  fullName: string;

  @Column({ type: "varchar", nullable: true })
  avatar: string | null;

  @Column({ type: "text", nullable: true })
  bio: string | null;

  @Column({ type: "int", default: 0 })
  totalXP: number;

  @Column({ type: "int", default: 1 })
  level: number;

  @Column({ type: "int", default: 0 })
  testsCompleted: number;

  @Column({ type: "int", default: 0 })
  zikrCount: number;

  @Column({ type: "enum", enum: Role, default: Role.USER })
  role: Role;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "varchar", nullable: true, unique: true })
  telegramId: string | null;

  @Column({ type: "varchar", nullable: true })
  phone: string | null;

  @Column({ type: "varchar", nullable: true })
  telegramPhone: string | null;

  @Column({ type: "varchar", nullable: true })
  telegramUsername: string | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastActiveAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations (using string-based references to avoid circular imports)
  @OneToMany("TestAttempt", "user")
  testAttempts: any[];

  @OneToMany("UserAchievement", "user")
  userAchievements: any[];

  @OneToMany("AIChat", "user")
  aiChats: any[];

  @OneToMany("CategoryStat", "user")
  categoryStats: any[];

  @OneToMany("Notification", "user")
  notifications: any[];

  @OneToMany("AdminMessage", "admin")
  sentMessages: any[];

  @OneToMany("WeeklyXP", "user")
  weeklyXP: any[];

  @OneToMany("MonthlyXP", "user")
  monthlyXP: any[];

  @OneToMany("ZikrCompletion", "user")
  zikrCompletions: any[];
}
