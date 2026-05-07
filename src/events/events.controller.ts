import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // POST /events — 创建 event
  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  // GET /events/:id — 按 id 查询
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.findOne(id);
  }

  // DELETE /events/:id — 删除
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 返回 204，相当于 DRF 的 Response(status=204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.remove(id);
  }

  // POST /events/merge/:userId — 合并用户的所有重叠事件
  // 注意：这个路由必须放在 :id 路由之前，否则 "merge" 会被当成 id 解析
  @Post('merge/:userId')
  mergeAll(@Param('userId', ParseIntPipe) userId: number) {
    return this.eventsService.mergeAll(userId);
  }
}
