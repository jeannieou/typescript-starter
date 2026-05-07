import { IsString,Length } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(2, 20, { message: 'name length shoud be 2-20 char' })
  name: string;
}
