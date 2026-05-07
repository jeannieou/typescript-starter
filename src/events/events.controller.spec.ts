import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event, EventStatus } from './entities/event.entity';
import { NotFoundException } from '@nestjs/common';

// Mock service：模拟 service 层，controller 单元测试只测路由逻辑
const mockEventsService = {
  create: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  mergeAll: jest.fn(),
};

function makeEvent(overrides: Partial<Event> = {}): Event {
  const e = new Event();
  e.id = 1;
  e.title = 'Test';
  e.status = EventStatus.TODO;
  e.startTime = new Date('2024-01-01T14:00:00Z');
  e.endTime = new Date('2024-01-01T15:00:00Z');
  e.invitees = [];
  return Object.assign(e, overrides);
}

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: mockEventsService }],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call service.create and return the event', async () => {
      const dto = {
        title: 'Meeting',
        status: EventStatus.TODO,
        startTime: '2024-01-01T14:00:00Z',
        endTime: '2024-01-01T15:00:00Z',
      };
      const event = makeEvent({ title: 'Meeting' });
      mockEventsService.create.mockResolvedValue(event);

      const result = await controller.create(dto as any);
      expect(mockEventsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(event);
    });
  });

  describe('findOne', () => {
    it('should return event by id', async () => {
      const event = makeEvent();
      mockEventsService.findOne.mockResolvedValue(event);

      const result = await controller.findOne(1);
      expect(result).toEqual(event);
    });

    it('should propagate NotFoundException from service', async () => {
      mockEventsService.findOne.mockRejectedValue(
        new NotFoundException('Event #99 not found'),
      );

      await expect(controller.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should call service.remove', async () => {
      mockEventsService.remove.mockResolvedValue(undefined);

      await controller.remove(1);
      expect(mockEventsService.remove).toHaveBeenCalledWith(1);
    });
  });

  describe('mergeAll', () => {
    it('should call service.mergeAll with userId', async () => {
      const merged = [makeEvent({ title: 'E1 | E2' })];
      mockEventsService.mergeAll.mockResolvedValue(merged);

      const result = await controller.mergeAll(5);
      expect(mockEventsService.mergeAll).toHaveBeenCalledWith(5);
      expect(result).toEqual(merged);
    });
  });
});
