import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum EventStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity()
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  // enum 字段，等同于 Django CharField(choices=EventStatus.choices)
  @Column({ type: 'simple-enum', enum: EventStatus })
  status: EventStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime' })
  startTime: Date;

  @Column({ type: 'datetime' })
  endTime: Date;

  // 主控方：@JoinTable() 在这里，TypeORM 会创建 event_invitees_user 关联表
  @ManyToMany(() => User, (user) => user.events, { eager: true })
  @JoinTable()
  invitees: User[];
}
