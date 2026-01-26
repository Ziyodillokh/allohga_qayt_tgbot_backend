import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("weekly_xp")
@Unique(["userId", "weekStart"])
@Index(["weekStart"])
@Index(["xp"])
export class WeeklyXP {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "int", default: 0 })
  xp: number;

  @Column({ type: "timestamp" })
  weekStart: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
