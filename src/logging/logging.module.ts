import { Module } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [LoggingService],
  exports: [LoggingService],
})
export class LoggingModule {} 