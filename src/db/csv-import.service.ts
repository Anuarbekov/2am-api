import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelemetryReading } from './telemetry-reading.entity';
import { DeepPartial } from 'typeorm';

import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

@Injectable()
export class CsvImportService {
    private readonly logger = new Logger(CsvImportService.name);

    constructor(
        @InjectRepository(TelemetryReading)
        private readonly repo: Repository<TelemetryReading>,
    ) {}

    async importFromCsv(filePath: string): Promise<void> {
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`CSV file not found: ${absolutePath}`);
        }

        const rows: TelemetryReading[] = [];

        return new Promise((resolve, reject) => {
            fs.createReadStream(absolutePath)
                .pipe(csv())
                .on('data', (data) => {
                    try {
                        const row = this.mapRow(data);
                        rows.push(row);
                    } catch (err) {
                        this.logger.warn(`Skipping invalid row: ${JSON.stringify(data)}`);
                    }
                })
                .on('end', async () => {
                    this.logger.log(`Parsed ${rows.length} rows`);

                    // Batch insert for performance
                    await this.repo.save(rows, { chunk: 500 });

                    this.logger.log('CSV import completed');
                    resolve();
                })
                .on('error', (err) => {
                    reject(err);
                });
        });
    }
    private mapRow(data: any): TelemetryReading {
        return this.repo.create({
            timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
            temp: this.toNumber(data.temp),
            pressure: this.toNumber(data.pressure),
            fuel: this.toNumber(data.fuel),
            speed: this.toNumber(data.speed),
        } as DeepPartial<TelemetryReading>);
    }

    private toNumber(value: any): number | null {
        if (value === undefined || value === null || value === '') return null;

        const n = Number(value);
        return Number.isNaN(n) ? null : n;
    }
}