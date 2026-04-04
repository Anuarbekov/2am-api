import { Injectable } from '@nestjs/common';
import { ProcessedTelemetry } from './signal-processing.service';

export type TelemetryField = 'fuel' | 'pressure' | 'temp' | 'speed';

export interface ContextCondition {
  field: TelemetryField;
  op: 'lte' | 'lt' | 'gte' | 'gt' | 'eq';
  value: number;
}

export interface MetricHealthConfig {
  weight: number;
  optimal: [number, number];
  critical: [number, number];
  contextualBands?: Array<{
    when: ContextCondition[];
    optimal: [number, number];
    critical: [number, number];
  }>;
}

export interface HealthConfig {
  speed: MetricHealthConfig;
  fuel: MetricHealthConfig;
  pressure: MetricHealthConfig;
  temp: MetricHealthConfig;
}

interface HealthFactor {
  parameter: string;
  impact: number;
  status: string;
}

export interface HealthResult {
  index: number;
  grade: string;
  factors: HealthFactor[];
  confidence: number;
}

function matchesCondition(
  data: ProcessedTelemetry,
  c: ContextCondition,
): boolean {
  const v = data[c.field];
  switch (c.op) {
    case 'lte':
      return v <= c.value;
    case 'lt':
      return v < c.value;
    case 'gte':
      return v >= c.value;
    case 'gt':
      return v > c.value;
    case 'eq':
      return v === c.value;
    default:
      return false;
  }
}

function resolveBands(
  cfg: MetricHealthConfig,
  data: ProcessedTelemetry,
): { optimal: [number, number]; critical: [number, number] } {
  if (cfg.contextualBands) {
    for (const rule of cfg.contextualBands) {
      if (rule.when.every((c) => matchesCondition(data, c))) {
        return { optimal: rule.optimal, critical: rule.critical };
      }
    }
  }
  return { optimal: cfg.optimal, critical: cfg.critical };
}

function scoreInBand(
  value: number,
  optimal: [number, number],
  critical: [number, number],
): number {
  const [optLo, optHi] = optimal;
  const [, critHi] = critical;

  if (value < optLo) {
    if (optLo <= 0) {
      return value < 0 ? 0 : 1;
    }
    return Math.max(0, value / optLo);
  }

  if (value > optHi) {
    const span = critHi - optHi;
    if (span <= 0) {
      return 0;
    }
    return Math.max(0, 1 - (value - optHi) / span);
  }

  return 1;
}

@Injectable()
export class HealthIndexService {
  private readonly config: HealthConfig = {
    speed: { weight: 0.2, optimal: [0, 80], critical: [80.1, 120] },
    fuel: { weight: 0.25, optimal: [100.1, 1000], critical: [0, 100] },
    pressure: { weight: 0.25, optimal: [5, 10], critical: [10.1, 15] },
    temp: {
      weight: 0.3,
      optimal: [75, 90],
      critical: [90.1, 100],
      contextualBands: [
        {
          when: [{ field: 'speed', op: 'lte', value: 1 }],
          optimal: [0, 100],
          critical: [100.1, 120],
        },
      ],
    },
  };

  computeHealthFromProcessed(data: ProcessedTelemetry): HealthResult {
    let totalScore = 0;
    const factors: HealthFactor[] = [];

    for (const [param, cfg] of Object.entries(this.config)) {
      const value = data[param as keyof ProcessedTelemetry] as number;
      const { optimal, critical } = resolveBands(cfg, data);
      const score = scoreInBand(value, optimal, critical);

      const contribution = score * cfg.weight;
      totalScore += contribution;

      let status = 'normal';
      if (score < 0.5) status = 'critical';
      else if (score < 0.75) status = 'warning';

      factors.push({
        parameter: param,
        impact: Math.round(contribution * 100),
        status,
      });
    }
    const confidenceFactor = data.confidence ?? 0.8;
    const adjustedScore = totalScore * confidenceFactor;
    const index = Math.round(adjustedScore * 100);

    let grade: string;
    if (index >= 85) grade = 'A';
    else if (index >= 70) grade = 'B';
    else if (index >= 55) grade = 'C';
    else if (index >= 40) grade = 'D';
    else grade = 'E';

    return {
      index,
      grade,
      factors: factors.sort((a, b) => b.impact - a.impact),
      confidence: confidenceFactor,
    };
  }

  getConfig(): HealthConfig {
    return this.config;
  }
}
