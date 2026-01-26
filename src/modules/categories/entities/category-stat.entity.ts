import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Category } from "./category.entity";

@Entity("category_stats")
@Unique(["userId", "categoryId"])
@Index(["userId"])
@Index(["categoryId"])
@Index(["totalXP"])
export class CategoryStat {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid" })
  categoryId: string;

  @Column({ type: "int", default: 0 })
  totalTests: number;

  @Column({ type: "int", default: 0 })
  totalQuestions: number;

  @Column({ type: "int", default: 0 })
  correctAnswers: number;

  @Column({ type: "int", default: 0 })
  totalXP: number;

  @Column({ type: "float", default: 0 })
  averageScore: number;

  @Column({ type: "int", default: 0 })
  bestScore: number;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Category, { onDelete: "CASCADE" })
  @JoinColumn({ name: "categoryId" })
  category: Category;
}
