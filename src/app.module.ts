import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RawTelemetry } from './entities/raw-telemetry.entity';
import { CleanupTask } from './tasks/cleanup.task';
import { TelemetryGateway } from './gateways/telemetry.gateway';
import { HealthIndexService } from './services/health-index.service';
import { SignalProcessingService } from './services/signal-processing.service';
import { RawTelemetryService } from './services/raw-telemetry.service';
import { TelemetryController } from './controllers/telemetry.controller';
import { TelemetryModule } from './modules/telementry.module';
import { TelemetryReplayStreamService } from './services/telemetry-replay-stream.service';
import { TelemetryRawWsService } from './services/telemetry-raw-ws.service';
import { TelemetryWsDocsController } from './controllers/telemetry-ws.docs.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT')),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [RawTelemetry],
        autoLoadEntities: true,
        synchronize: true, // dev only
      }),
    }),
    TypeOrmModule.forFeature([RawTelemetry]),
    TelemetryModule,
  ],
  controllers: [TelemetryController, TelemetryWsDocsController],
  providers: [
    RawTelemetryService,
    SignalProcessingService,
    HealthIndexService,
    TelemetryReplayStreamService,
    TelemetryRawWsService,
    TelemetryGateway,
    CleanupTask,
  ],
})
export class AppModule {}
