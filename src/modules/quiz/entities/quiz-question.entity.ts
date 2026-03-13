import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("quiz_questions")
export class QuizQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text" })
  questionText: string;

  @Column({ type: "varchar" })
  optionA: string;

  @Column({ type: "varchar" })
  optionB: string;

  @Column({ type: "varchar" })
  optionC: string;

  @Column({ type: "varchar" })
  optionD: string;

  @Column({ type: "varchar", length: 1 })
  correctOption: string; // 'a', 'b', 'c', 'd'

  @CreateDateColumn()
  createdAt: Date;
}
