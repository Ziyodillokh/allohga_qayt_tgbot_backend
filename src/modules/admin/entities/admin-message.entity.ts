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

@Entity("admin_messages")
@Index(["adminId"])
@Index(["sentAt"])
export class AdminMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  adminId: string;

  @Column({ type: "varchar" })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "varchar" })
  targetType: string;

  @Column({ type: "simple-array", default: "" })
  targetIds: string[];

  @Column({ type: "timestamp", nullable: true })
  scheduledAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  sentAt: Date | null;

  @Column({ type: "int", default: 0 })
  readCount: number;

  @Column({ type: "simple-array", default: "" })
  channels: string[];

  @Column({ type: "int", default: 0 })
  emailSent: number;

  @Column({ type: "varchar", nullable: true })
  imageUrl: string | null;

  @Column({ type: "int", default: 0 })
  notifSent: number;

  @Column({ type: "int", default: 0 })
  telegramSent: number;

  @Column({ type: "varchar", nullable: true })
  videoUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "adminId" })
  admin: User;
}
