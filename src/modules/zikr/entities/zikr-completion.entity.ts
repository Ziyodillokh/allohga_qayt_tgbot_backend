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
import { Zikr } from "./zikr.entity";

@Entity("zikr_completions")
@Index(["userId"])
@Index(["zikrId"])
@Index(["completedAt"])
export class ZikrCompletion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid" })
  zikrId: string;

  @Column({ type: "int", default: 0 })
  xpEarned: number;

  @CreateDateColumn()
  completedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Zikr, (zikr) => zikr.completions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "zikrId" })
  zikr: Zikr;
}
