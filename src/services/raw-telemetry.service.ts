import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { RawTelemetry } from '../entities/raw-telemetry.entity';
import {
  SignalProcessingService,
  ProcessedTelemetry,
} from './signal-processing.service';
import {parameters} from "../constants/parameters";

@Injectable()
export class RawTelemetryService {
  constructor(
    @InjectRepository(RawTelemetry)
    private rawRepository: Repository<RawTelemetry>,
    private signalProcessing: SignalProcessingService,
  ) {}

  async getProcessedTelemetry(
    since: Date,
    limit: number = 100,
  ): Promise<ProcessedTelemetry[]> {
    const rawData = await this.rawRepository.find({
      where: {
        timestamp: MoreThanOrEqual(since),
        quality: MoreThanOrEqual(50),
      },
      order: { timestamp: 'ASC' },
      take: limit,
    });
    if (rawData.length === 0) {
      return [];
    }

    const processed = await this.signalProcessing.processRawData(rawData);

    if (processed.length > 0) {
      this.signalProcessing.setLastProcessedValue(
        processed[processed.length - 1].timestamp,
        processed[processed.length - 1],
      );
    }

    return processed;
  }

  async getProcessedHistory(
    from: Date,
    to: Date,
    options?: { smooth?: boolean; outlierRemoval?: boolean },
  ): Promise<ProcessedTelemetry[]> {
    const rawData = await this.rawRepository.find({
      where: {
        timestamp: Between(from, to),
      },
      order: { timestamp: 'ASC' },
    });

    let processed = await this.signalProcessing.processRawDataIsolated(rawData);

    if (options?.smooth && processed.length > 5) {
      processed = this.extraSmoothing(processed);
    }

    return processed;
  }

  private extraSmoothing(data: ProcessedTelemetry[]): ProcessedTelemetry[] {
    if (data.length < 5) return data;

    const smoothed = JSON.parse(JSON.stringify(data));

    for (let i = 2; i < data.length - 2; i++) {
      for (const param of parameters) {
        const values: number[] = [];
        for (let j = -2; j <= 2; j++) {
          values.push(data[i + j][param]);
        }
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        smoothed[i][param] = avg;
      }
    }

    return smoothed;
  }

  async getOldestTimestamp(): Promise<Date | null> {
    const oldest = await this.rawRepository.findOne({
      order: { timestamp: 'ASC' },
    });
    return oldest?.timestamp || null;
  }

  async getOldestProcessed(): Promise<ProcessedTelemetry | null> {
    const oldestRaw = await this.rawRepository.findOne({
      where: { quality: MoreThanOrEqual(50) },
      order: { timestamp: 'ASC' },
    });
    if (!oldestRaw) return null;

    const processed = await this.signalProcessing.processRawData([oldestRaw]);

    if (processed.length > 0) {
      this.signalProcessing.setLastProcessedValue(
        processed[processed.length - 1].timestamp,
        processed[processed.length - 1],
      );
      return processed[0];
    }

    return null;
  }
}
