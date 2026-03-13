import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { QuizSession } from "./quiz-session.entity";
import { QuizQuestion } from "./quiz-question.entity";

@Entity("quiz_answers")
@Index(["quizSessionId", "questionId", "userId"], { unique: true })
export class QuizAnswer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  quizSessionId: string;

  @Column({ type: "uuid" })
  questionId: string;

  @Column({ type: "bigint" })
  userId: string;

  @Column({ type: "varchar", nullable: true })
  username: string | null;

  @Column({ type: "varchar", length: 1 })
  selectedOption: string; // 'a', 'b', 'c', 'd'

  @Column({ type: "boolean" })
  isCorrect: boolean;

  @Column({ type: "bigint" })
  responseTime: string; // milliseconds as string for bigint

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => QuizSession, { onDelete: "CASCADE" })
  @JoinColumn({ name: "quizSessionId" })
  quizSession: QuizSession;

  @ManyToOne(() => QuizQuestion, { onDelete: "CASCADE" })
  @JoinColumn({ name: "questionId" })
  quizQuestion: QuizQuestion;
}
