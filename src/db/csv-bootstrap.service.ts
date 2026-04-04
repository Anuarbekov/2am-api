import { Injectable, OnModuleInit } from '@nestjs/common';
import { CsvImportService } from './csv-import.service';

@Injectable()
export class CsvBootstrapService implements OnModuleInit {
    constructor(private readonly csvService: CsvImportService) {}

    async onModuleInit() {
        await this.csvService.importFromCsv('../../datasource/loco_telemetry.csv');
    }
}