import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Event } from '../../events/entities/event.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // ManyToMany 由 Event 那边的 @JoinTable() 控制（反向关系）
  // 等同于 Django 的 ManyToManyField(Event, related_name='invitees')
  @ManyToMany(() => Event, (event) => event.invitees)
  events: Event[];
}
