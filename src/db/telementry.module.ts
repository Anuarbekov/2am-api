import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TelemetryReading } from './telemetry-reading.entity';
import { CsvImportService } from './csv-import.service';
import { CsvBootstrapService } from './csv-bootstrap.service';

@Module({
    imports: [TypeOrmModule.forFeature([TelemetryReading])],
    providers: [CsvImportService, CsvBootstrapService],
    exports: [CsvImportService],
})
export class TelemetryModule {}