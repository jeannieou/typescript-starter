import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

function makeUser(overrides: Partial<User> = {}): User {
  const u = new User();
  u.id = 1;
  u.name = 'Alice';
  u.events = [];
  return Object.assign(u, overrides);
}

const mockUserRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findByIds: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof mockUserRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('create', () => {
    it('should create and return a user', async () => {
      const dto = { name: 'Alice' };
      const user = makeUser();
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);

      const result = await service.create(dto);
      expect(userRepo.create).toHaveBeenCalledWith(dto);
      expect(userRepo.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne(1);
      expect(result).toEqual(user);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['events'],
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIds', () => {
    it('should return users for given ids', async () => {
      const users = [makeUser({ id: 1 }), makeUser({ id: 2, name: 'Bob' })];
      userRepo.findByIds.mockResolvedValue(users);

      const result = await service.findByIds([1, 2]);
      expect(result).toEqual(users);
    });

    it('should return empty array for empty ids list', async () => {
      const result = await service.findByIds([]);
      expect(result).toEqual([]);
      expect(userRepo.findByIds).not.toHaveBeenCalled();
    });

    it('should return empty array for null/undefined ids', async () => {
      const result = await service.findByIds(null);
      expect(result).toEqual([]);
    });
  });
});
