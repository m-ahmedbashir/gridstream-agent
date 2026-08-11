import { Module } from '@nestjs/common';
import { ExtractionController } from './extraction.controller';

@Module({
    controllers: [ExtractionController],
})
export class ExtractionModule { }
