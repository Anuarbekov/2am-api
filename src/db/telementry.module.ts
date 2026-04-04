import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CsvImportService } from './csv-import.service';
import { CsvBootstrapService } from './csv-bootstrap.service';
import { RawTelemetry } from 'src/entities/raw-telemetry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RawTelemetry])],
  providers: [CsvImportService, CsvBootstrapService],
  exports: [CsvImportService],
})
export class TelemetryModule {}
