import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";

@Entity("categories")
@Index(["slug"])
@Index(["isActive"])
@Index(["group"])
export class Category {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", nullable: true })
  nameEn: string | null;

  @Column({ type: "varchar", nullable: true })
  nameRu: string | null;

  @Column({ type: "varchar", unique: true })
  slug: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", nullable: true })
  icon: string | null;

  @Column({ type: "varchar", default: "#6366f1" })
  color: string;

  @Column({ type: "int", default: 0 })
  order: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "varchar", default: "other" })
  group: string;

  @Column({ type: "simple-array", default: "Oson,Orta,Qiyin" })
  difficultyLevels: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations (using string-based references to avoid circular imports)
  @OneToMany("Question", "category")
  questions: any[];

  @OneToMany("TestAttempt", "category")
  testAttempts: any[];

  @OneToMany("CategoryStat", "category")
  categoryStats: any[];

  @OneToMany("AIChat", "category")
  aiChats: any[];
}
