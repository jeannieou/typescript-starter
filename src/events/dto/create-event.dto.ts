import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsArray,
  IsNumber,
} from 'class-validator';
import { EventStatus } from '../entities/event.entity';

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(EventStatus)
  status: EventStatus;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  inviteeIds?: number[];
}
