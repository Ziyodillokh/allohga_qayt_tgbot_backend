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

@Entity("monthly_xp")
@Unique(["userId", "monthStart"])
@Index(["monthStart"])
@Index(["xp"])
export class MonthlyXP {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "int", default: 0 })
  xp: number;

  @Column({ type: "timestamp" })
  monthStart: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
