import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { Event, EventStatus } from './entities/event.entity';
import { User } from '../users/entities/user.entity';

// create a fake event
function makeEvent(overrides: Partial<Event> = {}): Event {
  const e = new Event();
  e.id = 1;
  e.title = 'Test Event';
  e.description = 'desc';
  e.status = EventStatus.TODO;
  e.startTime = new Date('2024-01-01T14:00:00Z');
  e.endTime = new Date('2024-01-01T15:00:00Z');
  e.invitees = [];
  return Object.assign(e, overrides);
}

// create a fake user
function makeUser(overrides: Partial<User> = {}): User {
  const u = new User();
  u.id = 1;
  u.name = 'Alice';
  u.events = [];
  return Object.assign(u, overrides);
}

// Mock Repository factory：模拟 TypeORM 的 Repository
const mockEventRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  findByIds: jest.fn(),
  findBy: jest.fn(),
});

const mockUserRepo = () => ({
  findOne: jest.fn(),
  findByIds: jest.fn(),
  findBy: jest.fn(),
});

describe('EventsService', () => {
  let service: EventsService;
  let eventRepo: ReturnType<typeof mockEventRepo>;
  let userRepo: ReturnType<typeof mockUserRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useFactory: mockEventRepo },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    eventRepo = module.get(getRepositoryToken(Event));
    userRepo = module.get(getRepositoryToken(User));
  });

  // ─── create ───────────────────────────────────────────
  describe('create', () => {
    it('should create and return an event', async () => {
      const dto = {
        title: 'Meeting',
        description: 'Team sync',
        status: EventStatus.TODO,
        startTime: '2024-01-01T14:00:00Z',
        endTime: '2024-01-01T15:00:00Z',
        inviteeIds: [],
      };
      const expected = makeEvent({ title: 'Meeting' });

      userRepo.findBy.mockResolvedValue([]);
      eventRepo.create.mockReturnValue(expected);
      eventRepo.save.mockResolvedValue(expected);

      const result = await service.create(dto);
      expect(result).toEqual(expected);
      expect(eventRepo.save).toHaveBeenCalledWith(expected);
    });
  });

  // ─── findOne ──────────────────────────────────────────
  describe('findOne', () => {
    it('should return an event by id', async () => {
      const event = makeEvent();
      eventRepo.findOne.mockResolvedValue(event);

      const result = await service.findOne(1);
      expect(result).toEqual(event);
    });

    it('should throw NotFoundException if event not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ───────────────────────────────────────────
  describe('remove', () => {
    it('should delete the event', async () => {
      const event = makeEvent();
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.remove.mockResolvedValue(undefined);

      await service.remove(1);
      expect(eventRepo.remove).toHaveBeenCalledWith(event);
    });

    it('should throw NotFoundException if event does not exist', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── mergeAll ─────────────────────────────────────────
  describe('mergeAll', () => {
    it('should return empty array if user has no events', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ events: [] }));

      const result = await service.mergeAll(1);
      expect(result).toEqual([]);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.mergeAll(999)).rejects.toThrow(NotFoundException);
    });

    it('should merge two overlapping events', async () => {
      const userA = makeUser({ id: 1, name: 'Alice' });
      const userB = makeUser({ id: 2, name: 'Bob' });

      const e1 = makeEvent({
        id: 1,
        title: 'E1',
        status: EventStatus.TODO,
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T15:00:00Z'),
        invitees: [userA],
      });
      const e2 = makeEvent({
        id: 2,
        title: 'E2',
        status: EventStatus.IN_PROGRESS,
        startTime: new Date('2024-01-01T14:45:00Z'),
        endTime: new Date('2024-01-01T16:00:00Z'),
        invitees: [userB],
      });

      const user = makeUser({ events: [e1, e2] });
      userRepo.findOne.mockResolvedValue(user);

      const mergedEvent = makeEvent({
        id: 3,
        title: 'E1 | E2',
        status: EventStatus.IN_PROGRESS,
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T16:00:00Z'),
        invitees: [userA, userB],
      });
      eventRepo.save.mockResolvedValue(mergedEvent);
      eventRepo.remove.mockResolvedValue(undefined);

      const result = await service.mergeAll(1);

      expect(eventRepo.save).toHaveBeenCalledTimes(1);
      expect(eventRepo.remove).toHaveBeenCalledWith([e1, e2]);
      expect(result[0].title).toBe('E1 | E2');
    });

    it('should not merge non-overlapping events', async () => {
      const e1 = makeEvent({
        id: 1,
        title: 'Morning',
        startTime: new Date('2024-01-01T09:00:00Z'),
        endTime: new Date('2024-01-01T10:00:00Z'),
        invitees: [],
      });
      const e2 = makeEvent({
        id: 2,
        title: 'Afternoon',
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T15:00:00Z'),
        invitees: [],
      });

      const user = makeUser({ events: [e1, e2] });
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.mergeAll(1);

      expect(eventRepo.save).not.toHaveBeenCalled();
      expect(eventRepo.remove).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should pick COMPLETED status when merging', async () => {
      const e1 = makeEvent({
        id: 1,
        title: 'E1',
        status: EventStatus.TODO,
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T15:00:00Z'),
        invitees: [],
      });
      const e2 = makeEvent({
        id: 2,
        title: 'E2',
        status: EventStatus.COMPLETED,
        startTime: new Date('2024-01-01T14:30:00Z'),
        endTime: new Date('2024-01-01T16:00:00Z'),
        invitees: [],
      });

      const user = makeUser({ events: [e1, e2] });
      userRepo.findOne.mockResolvedValue(user);

      let savedEvent: Event;
      eventRepo.save.mockImplementation((e: Event) => {
        savedEvent = e;
        return Promise.resolve({ ...e, id: 3 });
      });
      eventRepo.remove.mockResolvedValue(undefined);

      await service.mergeAll(1);

      expect(savedEvent!.status).toBe(EventStatus.COMPLETED);
    });
  });
});
