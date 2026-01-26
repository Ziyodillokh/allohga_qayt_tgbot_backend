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
import { Achievement } from "./achievement.entity";

@Entity("user_achievements")
@Unique(["userId", "achievementId"])
@Index(["userId"])
export class UserAchievement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid" })
  achievementId: string;

  @Column({ type: "int", default: 0 })
  progress: number;

  @Column({ type: "timestamp", nullable: true })
  unlockedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Achievement, (ach) => ach.userAchievements, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "achievementId" })
  achievement: Achievement;
}
