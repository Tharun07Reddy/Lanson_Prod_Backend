import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import databaseConfig from '../config/database.config';

@Global()
@Module({
    imports: [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ConfigModule.forFeature(databaseConfig),
    ],
    providers: [PrismaService],
    exports: [PrismaService],
})
export class DatabaseModule { } 