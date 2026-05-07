# Demo Video Link

https://youtu.be/E8phs1K8nsI

# NestJS Event Management API

A REST API for managing events and users, built with NestJS + TypeORM + SQLite.

## Features

- Create, retrieve, and delete **Events**
- Create and retrieve **Users**
- **MergeAll**: Merge all overlapping events for a given user (interval-merge algorithm)

## Project Setup

```bash
npm install
```

## Running the App

```bash
# Development (watch mode — restarts on file change)
npm run start:dev

# One-time run
npm run start
```

The app runs on **http://localhost:3000**

> SQLite database is created automatically at `data/events.db` on first run.

## API Endpoints

### Events

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/events` | Create a new event |
| `GET` | `/events/:id` | Get event by ID |
| `DELETE` | `/events/:id` | Delete event by ID |
| `POST` | `/events/merge/:userId` | Merge all overlapping events for a user |

### Users

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/users` | Create a new user |
| `GET` | `/users/:id` | Get user by ID |

### Example Requests

**Create a User**
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'
```

**Create an Event**
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Meeting",
    "description": "Weekly sync",
    "status": "TODO",
    "startTime": "2024-06-01T14:00:00.000Z",
    "endTime": "2024-06-01T15:00:00.000Z",
    "inviteeIds": [1]
  }'
```

**Merge Overlapping Events for User 1**
```bash
curl -X POST http://localhost:3000/events/merge/1
```

Event `status` must be one of: `TODO`, `IN_PROGRESS`, `COMPLETED`

## Running Tests

```bash
# Unit tests (uses mocked repositories, no database)
npm run test

# Integration / E2E tests (uses in-memory SQLite)
npm run test:e2e

# Coverage report
npm run test:cov
```

## Architecture

```
src/
├── events/
│   ├── dto/create-event.dto.ts     # Request validation 
│   ├── entities/event.entity.ts    # Database model 
│   ├── events.controller.ts        # HTTP routes 
│   ├── events.service.ts           # Business logic
│   └── events.module.ts            # Module registration
└── users/
    ├── dto/create-user.dto.ts
    ├── entities/user.entity.ts
    ├── users.controller.ts
    ├── users.service.ts
    └── users.module.ts
```

## MergeAll Algorithm

Given a user ID, the merge algorithm:
1. Fetches all events the user is invited to
2. Sorts events by `startTime`
3. Groups overlapping intervals (classic interval-merge: if `event.startTime <= current.endTime`, they overlap)
4. For each overlapping group, creates one merged event:
   - **title**: joined with ` | `
   - **description**: joined with ` | `
   - **status**: picks the most advanced (`COMPLETED` > `IN_PROGRESS` > `TODO`)
   - **startTime**: earliest start
   - **endTime**: latest end
   - **invitees**: union of all invitees
5. Deletes the original events, saves the merged ones

## Database

- **Development**: SQLite file at `data/events.db` (auto-created)
- **Tests**: In-memory SQLite (`:memory:`) — no setup needed

To use PostgreSQL in production, change `app.module.ts`:
```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'your_user',
  password: 'your_password',
  database: 'your_db',
  entities: [Event, User],
  synchronize: true,
})
```
