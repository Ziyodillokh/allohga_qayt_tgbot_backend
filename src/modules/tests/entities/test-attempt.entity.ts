import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Category } from "../../categories/entities/category.entity";
import { TestAnswer } from "./test-answer.entity";

@Entity("test_attempts")
@Index(["userId"])
@Index(["categoryId"])
@Index(["createdAt"])
export class TestAttempt {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @Column({ type: "uuid", nullable: true })
  categoryId: string | null;

  @Column({ type: "int", default: 0 })
  score: number;

  @Column({ type: "int", default: 10 })
  totalQuestions: number;

  @Column({ type: "int", default: 0 })
  correctAnswers: number;

  @Column({ type: "int", default: 0 })
  xpEarned: number;

  @Column({ type: "int", nullable: true })
  timeSpent: number | null;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Category, { onDelete: "SET NULL" })
  @JoinColumn({ name: "categoryId" })
  category: Category;

  @OneToMany(() => TestAnswer, (ta) => ta.testAttempt)
  testAnswers: TestAnswer[];
}
