import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from "typeorm";

@Entity("quiz_settings")
export class QuizSettings {
  @PrimaryColumn({ type: "int", default: 1 })
  id: number;

  @Column({ type: "int", default: 15 })
  answerTimeSeconds: number;

  @Column({ type: "int", default: 45 })
  waitTimeSeconds: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
