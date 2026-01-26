import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { UserAchievement } from "./user-achievement.entity";

@Entity("achievements")
export class Achievement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", nullable: true })
  nameEn: string | null;

  @Column({ type: "varchar", nullable: true })
  nameRu: string | null;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar" })
  icon: string;

  @Column({ type: "jsonb" })
  condition: any;

  @Column({ type: "int", default: 0 })
  xpReward: number;

  @Column({ type: "int", default: 0 })
  order: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @OneToMany(() => UserAchievement, (ua) => ua.achievement)
  userAchievements: UserAchievement[];
}
