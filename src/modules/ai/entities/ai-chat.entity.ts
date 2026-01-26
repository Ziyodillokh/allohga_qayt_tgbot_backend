import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Category } from "../../categories/entities/category.entity";

@Entity("ai_chats")
@Index(["userId"])
@Index(["createdAt"])
export class AIChat {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid", nullable: true })
  categoryId: string | null;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "text" })
  response: string;

  @Column({ type: "int", nullable: true })
  tokens: number | null;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Category, { onDelete: "SET NULL" })
  @JoinColumn({ name: "categoryId" })
  category: Category;
}
