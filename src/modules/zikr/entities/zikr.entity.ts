import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { ZikrCompletion } from "./zikr-completion.entity";

@Entity("zikrs")
@Index(["dayOfWeek"])
@Index(["isRamadan"])
@Index(["isActive"])
@Index(["order"])
export class Zikr {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  titleArabic: string;

  @Column({ type: "varchar" })
  titleLatin: string;

  @Column({ type: "text" })
  textArabic: string;

  @Column({ type: "text" })
  textLatin: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "int", default: 33 })
  count: number;

  @Column({ type: "varchar", default: "📿" })
  emoji: string;

  @Column({ type: "int" })
  dayOfWeek: number;

  @Column({ type: "boolean", default: false })
  isRamadan: boolean;

  @Column({ type: "int", default: 0 })
  order: number;

  @Column({ type: "int", default: 1 })
  xpReward: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => ZikrCompletion, (zc) => zc.zikr)
  completions: ZikrCompletion[];
}
