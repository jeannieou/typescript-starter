import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局启用请求验证：相当于 DRF serializer 的自动验证
  // whitelist: true 会剔除 DTO 里没声明的字段（防止多余字段注入）
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.listen(3000);
  console.log('App running on http://localhost:3000');
}
bootstrap();
