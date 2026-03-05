import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS so your Next.js Frontend (Port 3000) can talk to this Backend (Port 3001)
  app.enableCors();

  // 2. Use the PORT from cross-env or default to 3001 to avoid conflicts
  const port = process.env.PORT || 3001;

  await app.listen(port);
  console.log(`🚀 Backend is running on: http://localhost:${port}`);
}
bootstrap();