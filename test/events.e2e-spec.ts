import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../src/events/events.module';
import { UsersModule } from '../src/users/users.module';
import { Event } from '../src/events/entities/event.entity';
import { User } from '../src/users/entities/user.entity';
import { EventStatus } from '../src/events/entities/event.entity';

// integration test：using SQLite store in mem, so every run is clean start
describe('Events API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // creating a test app
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Event, User],
          synchronize: true,
        }),
        EventsModule,
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── POST /events ──────────────────────────────────────
  describe('POST /events', () => {
    it('should create an event', async () => {
      const res = await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Team Sync',
          description: 'Weekly meeting',
          status: 'TODO',
          startTime: '2024-06-01T14:00:00.000Z',
          endTime: '2024-06-01T15:00:00.000Z',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Team Sync');
      expect(res.body.status).toBe('TODO');
    });

    it('should return 400 for invalid status', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Bad Event',
          status: 'INVALID_STATUS',
          startTime: '2024-06-01T14:00:00.000Z',
          endTime: '2024-06-01T15:00:00.000Z',
        })
        .expect(400);
    });

    it('should return 400 when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .send({
          status: 'TODO',
          startTime: '2024-06-01T14:00:00.000Z',
          endTime: '2024-06-01T15:00:00.000Z',
        })
        .expect(400);
    });
  });

  // ─── GET /events/:id ───────────────────────────────────
  describe('GET /events/:id', () => {
    let createdId: number;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Standup',
          status: EventStatus.IN_PROGRESS,
          startTime: '2024-06-01T09:00:00.000Z',
          endTime: '2024-06-01T09:30:00.000Z',
        });
      createdId = res.body.id;
    });

    it('should return the event by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/events/${createdId}`)
        .expect(200);

      expect(res.body.id).toBe(createdId);
      expect(res.body.title).toBe('Standup');
    });

    it('should return 404 for non-existent event', async () => {
      await request(app.getHttpServer()).get('/events/99999').expect(404);
    });
  });

  // ─── DELETE /events/:id ────────────────────────────────
  describe('DELETE /events/:id', () => {
    it('should delete an event and return 204', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'To Delete',
          status: EventStatus.TODO,
          startTime: '2024-06-01T10:00:00.000Z',
          endTime: '2024-06-01T11:00:00.000Z',
        });
      const id = createRes.body.id;

      await request(app.getHttpServer()).delete(`/events/${id}`).expect(204);

      // confirm delete and sent 404
      await request(app.getHttpServer()).get(`/events/${id}`).expect(404);
    });
  });

  // ─── POST /events/merge/:userId ────────────────────────
  describe('POST /events/merge/:userId', () => {
    it('should merge overlapping events for a user', async () => {
      // 1. create two users
      const userARes = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Alice' });
      const userBRes = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Bob' });
      const userAId = userARes.body.id;
      const userBId = userBRes.body.id;

      // 2. create two overlapping event both invited A
      // E1: 2pm-3pm, E2: 2:45pm-4pm => overlap
      await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Meeting A',
          status: EventStatus.TODO,
          startTime: '2024-06-01T14:00:00.000Z',
          endTime: '2024-06-01T15:00:00.000Z',
          inviteeIds: [userAId, userBId],
        });

      await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Meeting B',
          status: EventStatus.IN_PROGRESS,
          startTime: '2024-06-01T14:45:00.000Z',
          endTime: '2024-06-01T16:00:00.000Z',
          inviteeIds: [userAId],
        });

      // 3. call mergeAll
      const mergeRes = await request(app.getHttpServer())
        .post(`/events/merge/${userAId}`)
        .expect(201);

      expect(mergeRes.body).toHaveLength(1);
      expect(mergeRes.body[0].title).toBe('Meeting A | Meeting B');
      expect(mergeRes.body[0].status).toBe(EventStatus.IN_PROGRESS);
      // after merge startTime should be the earliest 
      expect(new Date(mergeRes.body[0].startTime).getTime()).toBe(
        new Date('2024-06-01T14:00:00.000Z').getTime(),
      );
      // after merge endTime should be the latest
      expect(new Date(mergeRes.body[0].endTime).getTime()).toBe(
        new Date('2024-06-01T16:00:00.000Z').getTime(),
      );
      // invitees should have both A and B
      const inviteeIds = mergeRes.body[0].invitees.map((u: User) => u.id);
      expect(inviteeIds).toContain(userAId);
      expect(inviteeIds).toContain(userBId);
    });

    it('should not merge non-overlapping events', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Charlie' });
      const userId = userRes.body.id;

      await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Morning',
          status: EventStatus.TODO,
          startTime: '2024-06-02T09:00:00.000Z',
          endTime: '2024-06-02T10:00:00.000Z',
          inviteeIds: [userId],
        });

      await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Afternoon',
          status: EventStatus.TODO,
          startTime: '2024-06-02T14:00:00.000Z',
          endTime: '2024-06-02T15:00:00.000Z',
          inviteeIds: [userId],
        });

      const mergeRes = await request(app.getHttpServer())
        .post(`/events/merge/${userId}`)
        .expect(201);

      // should return 2 event
      expect(mergeRes.body).toHaveLength(2);
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/events/merge/99999')
        .expect(404);
    });
  });
});
