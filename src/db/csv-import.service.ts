import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawTelemetry } from '../entities/raw-telemetry.entity';
import { DeepPartial } from 'typeorm';
import { CsvTelemetryRow } from './csv-row.interface';

import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(
    @InjectRepository(RawTelemetry)
    private readonly repo: Repository<RawTelemetry>,
  ) {}

  async importFromCsv(filePath: string): Promise<void> {
    const existingCount = await this.repo.count();

    if (existingCount > 0) {
      this.logger.log(
        'Telemetry data already exists in database. Skipping import.',
      );
      return;
    }
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`CSV file not found: ${absolutePath}`);
    }

    const rows: RawTelemetry[] = [];

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
        .on('error', (err) => {
          reject(err);
        })
        .on('end', () => {
          this.logger.log(
            `Parsed ${rows.length} rows. Starting database insertion...`,
          );

          this.repo
            .save(rows, { chunk: 500 })
            .then(() => {
              this.logger.log('CSV import completed successfully');
              resolve();
            })
            .catch((err) => {
              this.logger.error('Database save failed', err);
              reject(err);
            });
        });
    });
  }

  private mapRow(data: CsvTelemetryRow): RawTelemetry {
    return this.repo.create({
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      temp: this.toNumber(data.temp),
      pressure: this.toNumber(data.pressure),
      fuel: this.toNumber(data.fuel),
      speed: this.toNumber(data.speed),
      brake: this.toNumber(data.brake),
      engine: this.toNumber(data.engine),
    } as DeepPartial<RawTelemetry>);
  }

  private toNumber(value: any): number | null {
    if (value === undefined || value === null || value === '') return null;

    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
}
