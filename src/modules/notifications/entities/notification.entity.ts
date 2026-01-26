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

export enum NotificationType {
  SYSTEM = "SYSTEM",
  ACHIEVEMENT = "ACHIEVEMENT",
  LEVEL_UP = "LEVEL_UP",
  RANKING = "RANKING",
  MESSAGE = "MESSAGE",
}

@Entity("notifications")
@Index(["userId"])
@Index(["isRead"])
@Index(["createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "varchar" })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({
    type: "enum",
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @Column({ type: "boolean", default: false })
  isRead: boolean;

  @Column({ type: "jsonb", nullable: true })
  data: any;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
