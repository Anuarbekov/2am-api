import { Injectable, Logger } from '@nestjs/common';
import { RawTelemetry } from '../entities/raw-telemetry.entity';

export interface ProcessedTelemetry {
  timestamp: Date;
  fuel: number;
  pressure: number;
  temp: number;
  speed: number;
  quality: number;
  brake: number;
  engine: number;
  confidence: number;
}

interface EMASate {
  value: number;
  lastUpdate: Date;
}

interface ProcessedCacheEntry {
  timestamp: Date;
  data: any;
}

@Injectable()
export class SignalProcessingService {
  private readonly logger = new Logger(SignalProcessingService.name);
  private isolationMutex = Promise.resolve();

  private emaState: Map<string, EMASate> = new Map();
  private recentValues: Map<string, Array<{ value: number; timestamp: Date }>> =
    new Map();
  private lastProcessedCache: Map<string, ProcessedCacheEntry> = new Map();

  private readonly emaAlpha = {
    fuel: 0.3,
    pressure: 0.2,
    temp: 0.15,
    speed: 0.25,
    brake: 0.2,
    engine: 0.2,
  };

  private readonly medianWindow = 5000;

  constructor() {
    const params = [
      'fuel',
      'pressure',
      'temp',
      'speed',
      'brake',
      'engine',
    ] as const;
    for (const param of params) {
      this.recentValues.set(param, []);
    }
  }

  async processRawData(rawData: RawTelemetry[]): Promise<ProcessedTelemetry[]> {
    const processed: ProcessedTelemetry[] = [];

    for (const raw of rawData) {
      const validated = this.validateAndRemoveOutliers(raw);

      if (!validated) continue;

      const smoothed = this.applyEMA(validated);
      const medianFiltered = this.applyMedianFilter(smoothed);
      const confidence = this.calculateConfidence(medianFiltered);

      const processedItem: ProcessedTelemetry = {
        timestamp: raw.timestamp,
        fuel: medianFiltered.fuel ?? 0,
        pressure: medianFiltered.pressure ?? 0,
        temp: medianFiltered.temp ?? 0,
        speed: medianFiltered.speed ?? 0,
        quality: raw.quality,
        brake: medianFiltered.brake ?? 0,
        engine: medianFiltered.engine ?? 0,
        confidence,
      };
      processed.push(processedItem);
    return this.processRawDataSequential(rawData, false);
  }

  async processRawDataIsolated(
    rawData: RawTelemetry[],
  ): Promise<ProcessedTelemetry[]> {
    const prev = this.isolationMutex;
    let release!: () => void;
    this.isolationMutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return this.processRawDataSequential(rawData, true);
    } finally {
      release();
    }
  }

  private processRawDataSequential(
    rawData: RawTelemetry[],
    isolated: boolean,
  ): ProcessedTelemetry[] {
    const run = (): ProcessedTelemetry[] => {
      const processed: ProcessedTelemetry[] = [];

      for (const raw of rawData) {
        const validated = this.validateAndRemoveOutliers(raw);

        if (!validated) continue;

        const smoothed = this.applyEMA(validated);
        const medianFiltered = this.applyMedianFilter(smoothed);
        const confidence = this.calculateConfidence(medianFiltered);

        const processedItem: ProcessedTelemetry = {
          timestamp: raw.timestamp,
          fuel: medianFiltered.fuel ?? 0,
          pressure: medianFiltered.pressure ?? 0,
          temp: medianFiltered.temp ?? 0,
          speed: medianFiltered.speed ?? 0,
          quality: raw.quality,
          confidence,
        };

        processed.push(processedItem);
      }

      return processed;
    };

    if (!isolated) {
      return run();
    }

    const prevEma = this.emaState;
    const prevRecent = this.recentValues;
    const prevCache = this.lastProcessedCache;

    this.emaState = new Map();
    this.recentValues = new Map();
    for (const param of ['fuel', 'pressure', 'temp', 'speed']) {
      this.recentValues.set(param, []);
    }
    this.lastProcessedCache = new Map();

    try {
      return run();
    } finally {
      this.emaState = prevEma;
      this.recentValues = prevRecent;
      this.lastProcessedCache = prevCache;
    }
  }

  private validateAndRemoveOutliers(data: RawTelemetry): RawTelemetry | null {
    const checks = [
      { field: 'fuel' as const, min: 0, max: 1000 },
      { field: 'pressure' as const, min: 0, max: 10 },
      { field: 'temp' as const, min: -200, max: 2000 },
      { field: 'speed' as const, min: 0, max: 120 },
      { field: 'brake' as const, min: 0, max: 100 },
      { field: 'engine' as const, min: 0, max: 100 },
    ];

    for (const check of checks) {
      const value = data[check.field];
      if (
        value !== null &&
        value !== undefined &&
        (value < check.min || value > check.max)
      ) {
        return null;
      }
    }

    if (this.hasSuddenJump(data)) {
      return null;
    }

    return data;
  }

  private hasSuddenJump(current: RawTelemetry): boolean {
    const lastValue = this.getLastProcessedValue(current.timestamp);
    if (!lastValue) return false;

    const params = [
      'fuel',
      'pressure',
      'temp',
      'speed',
      'brake',
      'engine',
    ] as const;
    for (const param of params) {
      const currentVal = current[param];
      const lastVal = lastValue[param];

      if (currentVal && lastVal && lastVal !== 0) {
        const changePercent = Math.abs((currentVal - lastVal) / lastVal) * 100;
        if (changePercent > 30) {
          return true;
        }
      }
    }

    return false;
  }

  private applyEMA(current: RawTelemetry): RawTelemetry {
    const result = { ...current };
    const now = new Date();

    for (const [param, alpha] of Object.entries(this.emaAlpha)) {
      const currentValue = current[param as keyof RawTelemetry] as
        | number
        | null;
      if (currentValue === null || currentValue === undefined) continue;

      const lastState = this.emaState.get(param);

      if (!lastState) {
        this.emaState.set(param, { value: currentValue, lastUpdate: now });
        (result as any)[param] = currentValue;
      } else {
        const timeDiff = now.getTime() - lastState.lastUpdate.getTime();
        const adaptiveAlpha = this.getAdaptiveAlpha(alpha, timeDiff);
        const ema =
          adaptiveAlpha * currentValue + (1 - adaptiveAlpha) * lastState.value;
        this.emaState.set(param, { value: ema, lastUpdate: now });
        (result as any)[param] = ema;
      }
    }

    return result;
  }

  private getAdaptiveAlpha(baseAlpha: number, timeDiffMs: number): number {
    const expectedInterval = 1000;
    const factor = Math.min(2, Math.max(0.5, timeDiffMs / expectedInterval));
    return Math.min(0.5, baseAlpha * factor);
  }

  private applyMedianFilter(data: RawTelemetry): {
    fuel: number | null;
    pressure: number | null;
    temp: number | null;
    speed: number | null;
    brake: number | null;
    engine: number | null;
  } {
    const result = {
      fuel: null as number | null,
      pressure: null as number | null,
      temp: null as number | null,
      speed: null as number | null,
      brake: null as number | null,
      engine: null as number | null,
    };

    const now = data.timestamp;
    const windowStart = new Date(now.getTime() - this.medianWindow);

    for (const param of [
      'fuel',
      'pressure',
      'temp',
      'speed',
      'brake',
      'engine',
    ] as const) {
      let value = data[param];
      if (value === null || value === undefined) continue;

      const paramValues = this.recentValues.get(param) || [];
      paramValues.push({ value, timestamp: now });
      const filtered = paramValues.filter((v) => v.timestamp >= windowStart);
      this.recentValues.set(param, filtered);

      if (filtered.length >= 3) {
        const values = filtered.map((v) => v.value).sort((a, b) => a - b);
        value = values[Math.floor(values.length / 2)];
      }

      result[param] = value;
    }

    return result;
  }
  private calculateConfidence(data: {
    fuel: number | null;
    pressure: number | null;
    temp: number | null;
    speed: number | null;
    brake: number | null;
    engine: number | null;
  }): number {
    const fields = [
      'fuel',
      'pressure',
      'temp',
      'speed',
      'brake',
      'engine',
    ] as const;
    let present = 0;
    let reliabilitySum = 0;

    for (const f of fields) {
      const v = data[f];
      if (v === null || v === undefined) continue;
      present++;
      let r = 1;
      if (f === 'temp' && (v > 200 || v < -50)) r -= 0.25;
      if (f === 'pressure' && v > 50) r -= 0.25;
      if (f === 'fuel' && (v < 0 || v > 2000)) r -= 0.25;
      if (f === 'speed' && (v < 0 || v > 200)) r -= 0.25;
      if (f === 'brake' && (v < 0 || v > 100)) r -= 0.25;
      if (f === 'engine' && (v < 0 || v > 100)) r -= 0.25;
      reliabilitySum += Math.max(0, r);
    }

    if (present === 0) return 0;

    const availabilityScore = present / 4;
    const reliabilityScore = reliabilitySum / present;

    return Math.max(0, Math.min(1, availabilityScore * reliabilityScore));
  }

  private isDuplicate(
    current: {
      fuel: number | null;
      pressure: number | null;
      temp: number | null;
      speed: number | null;
    },
    timestamp: Date,
  ): boolean {
    const lastValue = this.getLastProcessedValue(timestamp);
    if (!lastValue) return false;

    const threshold = 0.01;
    const params = [
      'fuel',
      'pressure',
      'temp',
      'speed',
      'brake',
      'engine',
    ] as const;

    for (const param of params) {
      const currentVal = current[param];
      const lastVal = lastValue[param];

      if (currentVal && lastVal && lastVal !== 0) {
        const changePercent = Math.abs((currentVal - lastVal) / lastVal);
        if (changePercent > threshold) {
          return false;
        }
      }
    }

    return true;
  }

  private getLastProcessedValue(timestamp: Date): any {
    const last = Array.from(this.lastProcessedCache.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    )[0];
    return last?.data;
  }

  cleanup(maxAgeMs: number = 60000) {
    const now = new Date();
    for (const [key, state] of this.emaState.entries()) {
      if (now.getTime() - state.lastUpdate.getTime() > maxAgeMs) {
        this.emaState.delete(key);
      }
    }
  }

  setLastProcessedValue(timestamp: Date, data: any) {
    const key = timestamp.toISOString();
    this.lastProcessedCache.set(key, { timestamp, data });

    if (this.lastProcessedCache.size > 1000) {
      const oldest = Array.from(this.lastProcessedCache.keys())[0];
      this.lastProcessedCache.delete(oldest);
    }
  }
}
