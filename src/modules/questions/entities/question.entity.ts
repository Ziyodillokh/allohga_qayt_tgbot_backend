import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from "typeorm";
import { Category } from "../../categories/entities/category.entity";

export enum Difficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

@Entity("questions")
@Index(["categoryId"])
@Index(["difficulty"])
@Index(["levelIndex"])
@Index(["isActive"])
export class Question {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  categoryId: string;

  @Column({ type: "text" })
  question: string;

  @Column({ type: "simple-array" })
  options: string[];

  @Column({ type: "int" })
  correctAnswer: number;

  @Column({ type: "text", nullable: true })
  explanation: string | null;

  @Column({ type: "enum", enum: Difficulty, default: Difficulty.MEDIUM })
  difficulty: Difficulty;

  @Column({ type: "int", default: 1 })
  xpReward: number;

  @Column({ type: "simple-array", default: "" })
  tags: string[];

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "int", default: 0 })
  levelIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Category, (cat) => cat.questions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "categoryId" })
  category: Category;

  @OneToMany("TestAnswer", "question")
  testAnswers: any[];
}
