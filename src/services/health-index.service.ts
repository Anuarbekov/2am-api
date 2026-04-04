import { Injectable } from '@nestjs/common';
import { ProcessedTelemetry } from './signal-processing.service';

export interface HealthConfig {
  speed: {
    weight: number;
    optimal: [number, number];
    critical: [number, number];
  };
  fuel: {
    weight: number;
    optimal: [number, number];
    critical: [number, number];
  };
  pressure: {
    weight: number;
    optimal: [number, number];
    critical: [number, number];
  };
  temp: {
    weight: number;
    optimal: [number, number];
    critical: [number, number];
  };
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

@Injectable()
export class HealthIndexService {
  private readonly config: HealthConfig = {
    speed: { weight: 0.2, optimal: [0, 80], critical: [80.1, 120] },
    fuel: { weight: 0.25, optimal: [20.1, 100], critical: [0, 20] },
    pressure: { weight: 0.25, optimal: [0, 5], critical: [5.1, 10] },
    temp: { weight: 0.3, optimal: [75, 90], critical: [90.1, 100] },
  };

  computeHealthFromProcessed(data: ProcessedTelemetry): HealthResult {
    let totalScore = 0;
    const factors: HealthFactor[] = [];

    for (const [param, cfg] of Object.entries(this.config)) {
      const value = data[param as keyof ProcessedTelemetry] as number;

      let score = 1;

      if (value < cfg.optimal[0]) {
        score = Math.max(0, value / cfg.optimal[0]);
      } else if (value > cfg.optimal[1]) {
        score = Math.max(
          0,
          1 - (value - cfg.optimal[1]) / (cfg.critical[1] - cfg.optimal[1]),
        );
      }

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

    const confidenceFactor = data.confidence || 0.8;
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
