import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("design_settings")
export class DesignSetting {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", default: "default" })
  theme: string;

  @Column({ type: "varchar", nullable: true })
  lightVideoUrl: string | null;

  @Column({ type: "varchar", nullable: true })
  darkVideoUrl: string | null;

  @Column({ type: "varchar", nullable: true })
  lightImageUrl: string | null;

  @Column({ type: "varchar", nullable: true })
  darkImageUrl: string | null;

  @Column({ type: "boolean", default: true })
  videoLoop: boolean;

  @Column({ type: "boolean", default: true })
  videoMuted: boolean;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
