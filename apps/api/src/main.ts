import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from './app.module';
import { DbService } from './common/db/db.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS so your Next.js Frontend (Port 3000) can talk to this Backend (Port 3001)
  app.enableCors();

  // 2. Test database connection
  const dbService = app.get(DbService);
  try {
    await dbService.db.execute(sql`SELECT 1`);
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  // 3. Use the PORT from cross-env or default to 3001 to avoid conflicts
  const port = process.env.PORT || 3001;

  await app.listen(port);
  console.log(`🚀 Backend is running on: http://localhost:${port}`);
}
bootstrap();