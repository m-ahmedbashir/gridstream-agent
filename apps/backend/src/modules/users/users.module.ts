import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EncryptionService } from '../../common/crypto/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, EncryptionService],
  exports: [UsersService],
})
export class UsersModule {}
