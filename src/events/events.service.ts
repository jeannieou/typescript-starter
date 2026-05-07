import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { User } from '../users/entities/user.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { In } from 'typeorm';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateEventDto): Promise<Event> {
    const invitees = dto.inviteeIds?.length
      ? await this.userRepository.findBy({ id: In(dto.inviteeIds) })
      : [];

    const event = this.eventRepository.create({
      title: dto.title,
      description: dto.description,
      status: dto.status,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      invitees,
    });

    return this.eventRepository.save(event);
  }

  async findOne(id: number): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['invitees'],
    });
    if (!event) throw new NotFoundException(`Event #${id} not found`);
    return event;
  }

  async remove(id: number): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepository.remove(event);
  }

  // ──────────────────────────────────────────────
  // MergeAll: 合并一个 user 所有时间重叠的事件
  // ──────────────────────────────────────────────
  async mergeAll(userId: number): Promise<Event[]> {
    // 1. find all the event this user is in, as well as all the invitees in those events
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['events', 'events.invitees'],
    });
    if (!user) throw new NotFoundException(`User #${userId} not found`);

    const events = user.events;
    if (events.length === 0) return [];

    // 2. sort the start time in incresing order
    events.sort(
      (a, b) =>
        // converting the date to timestamp 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    // 3. put the overlapping event into one group
    const groups: Event[][] = [];
    let currentGroup: Event[] = [events[0]];
    let currentEnd = new Date(events[0].endTime).getTime();

    for (let i = 1; i < events.length; i++) {
      const start = new Date(events[i].startTime).getTime();
      const end = new Date(events[i].endTime).getTime();

      if (start <= currentEnd) {
        // if time overlaps, append this event to currentGroup
        currentGroup.push(events[i]);
        currentEnd = Math.max(currentEnd, end);
      } else {
        // if no overlap, create a new currentGroup
        groups.push(currentGroup);
        currentGroup = [events[i]];
        currentEnd = end;
      }
    }
    groups.push(currentGroup);

    // 4. only porcess the groups with more than 1 event
    const mergedEvents: Event[] = [];

    for (const group of groups) {
      if (group.length === 1) {
        mergedEvents.push(group[0]);
        continue;
      }

      // merge events in this group
      const merged = this.mergeGroup(group);

      // 5. save the new event/group 
      const saved = await this.eventRepository.save(merged);

      // 6. delete the previous event
      await this.eventRepository.remove(group);

      mergedEvents.push(saved);
    }

    return mergedEvents;
  }

  private mergeGroup(group: Event[]): Event {
    // title: connect the title with "|"
    const title = group.map((e) => e.title).join(' | ');

    // description: connect  with "|" and filted null description
    const description = group
      .map((e) => e.description)
      .filter(Boolean)
      .join(' | ') || null;

    // status: priority COMPLETED > IN_PROGRESS > TODO
    const statusPriority = {
      [EventStatus.COMPLETED]: 2,
      [EventStatus.IN_PROGRESS]: 1,
      [EventStatus.TODO]: 0,
    };
    const status = group.reduce((best, e) =>
      statusPriority[e.status] > statusPriority[best.status] ? e : best,
    ).status;

    // startTime: earliest
    const startTime = group.reduce((min, e) =>
      new Date(e.startTime) < new Date(min.startTime) ? e : min,
    ).startTime;

    // endTime: latest
    const endTime = group.reduce((max, e) =>
      new Date(e.endTime) > new Date(max.endTime) ? e : max,
    ).endTime;

    // invitees: get a set of all invitees
    const inviteeMap = new Map<number, User>();
    for (const event of group) {
      for (const invitee of event.invitees ?? []) {
        inviteeMap.set(invitee.id, invitee);
      }
    }
    const invitees = Array.from(inviteeMap.values());

    const merged = new Event();
    merged.title = title;
    merged.description = description;
    merged.status = status;
    merged.startTime = startTime;
    merged.endTime = endTime;
    merged.invitees = invitees;

    return merged;
  }
}
