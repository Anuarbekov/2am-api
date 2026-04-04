import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawTelemetry } from '../entities/raw-telemetry.entity';
import { DeepPartial } from 'typeorm';
import { CsvTelemetryRow } from '../interfaces/csv-row.interface';
import { toNumber } from "../utils/toNumber.util";

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
            temp: toNumber(data.temp),
            pressure: toNumber(data.pressure),
            fuel: toNumber(data.fuel),
            speed: toNumber(data.speed),
            brake: toNumber(data.brake),
            engine: toNumber(data.engine),
        } as DeepPartial<RawTelemetry>);
    }
}
