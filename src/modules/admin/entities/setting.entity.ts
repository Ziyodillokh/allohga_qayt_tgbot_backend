import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from "typeorm";

@Entity("settings")
export class Setting {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", unique: true })
  key: string;

  @Column({ type: "jsonb" })
  value: any;

  @UpdateDateColumn()
  updatedAt: Date;
}
