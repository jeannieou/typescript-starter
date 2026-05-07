import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // TypeOrmModule.forFeature([User]) 相当于告诉 Django：这个 app 管理 User 这张表
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule], // 导出让其他模块可以用 User repository
})
export class UsersModule {}
