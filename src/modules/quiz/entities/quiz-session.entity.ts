import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("quiz_sessions")
export class QuizSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "bigint" })
  chatId: string;

  @Column({ type: "int" })
  totalQuestions: number;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  finishedAt: Date | null;
}
