import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import { TestAttempt } from "./test-attempt.entity";
import { Question } from "../../questions/entities/question.entity";

@Entity("test_answers")
@Index(["testAttemptId"])
@Index(["questionId"])
export class TestAnswer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  testAttemptId: string;

  @Column({ type: "uuid" })
  questionId: string;

  @Column({ type: "int" })
  selectedAnswer: number;

  @Column({ type: "boolean" })
  isCorrect: boolean;

  @Column({ type: "int", nullable: true })
  timeSpent: number | null;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => TestAttempt, (ta) => ta.testAnswers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "testAttemptId" })
  testAttempt: TestAttempt;

  @ManyToOne(() => Question, { onDelete: "CASCADE" })
  @JoinColumn({ name: "questionId" })
  question: Question;
}
