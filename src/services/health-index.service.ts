import { Injectable } from '@nestjs/common';
import { ProcessedTelemetry } from '../interfaces/processed-telemetry.interface';
import { ContextCondition } from '../interfaces/context-condition.interface';
import { MetricHealthConfig } from '../interfaces/metric-health-config.interface';
import { HealthConfig } from '../interfaces/health-config.interface';
import { HealthFactor } from '../interfaces/health-factor.interface';
import { HealthResult } from '../interfaces/health-result.interface';
import { healthConfig } from '../constants/health-config';

@Injectable()
export class HealthIndexService {
  private readonly config: HealthConfig = healthConfig;

  computeHealthFromProcessed(data: ProcessedTelemetry): HealthResult {
    let totalScore = 0;
    let criticalCount = 0;
    const factors: HealthFactor[] = [];

    for (const [param, cfg] of Object.entries(this.config)) {
      const value = data[param as keyof ProcessedTelemetry] as number;
      const { optimal, critical } = this.resolveBands(cfg, data);
      const score = this.scoreInBand(value, optimal, critical);

      const contribution = score * cfg.weight;
      totalScore += contribution;

      let status = 'normal';
      if (score < 0.5) {
        status = 'critical';
        criticalCount++;
      } else if (score < 0.75) {
        status = 'warning';
      }

      factors.push({
        parameter: param,
        status,
        message: this.buildFactorMessage(param, value, optimal, status),
      });
    }

    const confidenceFactor = data.confidence ?? 0.8;

    const criticalPenalty = criticalCount > 0 ? 0.5 : 1.0;

    const adjustedScore = totalScore * confidenceFactor * criticalPenalty;
    const score = Math.round(adjustedScore * 100);

    return {
      score,
      grade: this.calculateGrade(score),
      factors,
    };
  }

  private resolveBands(
    cfg: MetricHealthConfig,
    data: ProcessedTelemetry,
  ): { optimal: [number, number]; critical: [number, number] } {
    if (cfg.contextualBands) {
      for (const rule of cfg.contextualBands) {
        if (rule.when.every((c) => this.matchesCondition(data, c))) {
          return { optimal: rule.optimal, critical: rule.critical };
        }
      }
    }
    return { optimal: cfg.optimal, critical: cfg.critical };
  }

  private matchesCondition(
    data: ProcessedTelemetry,
    c: ContextCondition,
  ): boolean {
    const v = data[c.field] ?? 0;
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

  private scoreInBand(
    value: number,
    optimal: [number, number],
    critical: [number, number],
  ): number {
    const [optLo, optHi] = optimal;
    const [critLo, critHi] = critical;

    if (value < optLo) {
      const range = optLo - critLo;
      if (range <= 0) return 0;
      const score = (value - critLo) / range;
      return Math.max(0, Math.min(1, score));
    }

    if (value > optHi) {
      const range = critHi - optHi;
      if (range <= 0) return 0;
      const score = 1 - (value - optHi) / range;
      return Math.max(0, Math.min(1, score));
    }

    return 1;
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'E';
  }

  private buildFactorMessage(
    parameter: string,
    value: number,
    optimal: [number, number],
    status: string,
  ): string {
    if (status === 'normal') {
      const normalMessages: Record<string, string> = {
        temp: 'Температура находится в пределах нормы.',
        pressure: 'Давление находится в пределах нормы.',
        fuel: 'Уровень топлива достаточный.',
        speed: 'Скорость находится в пределах безопасного диапазона.',
        brake: 'Состояние тормозов хорошее.',
        engine: 'Состояние двигателя хорошее.',
      };
      return normalMessages[parameter] || 'Работает в пределах нормы.';
    }

    const [optLo, optHi] = optimal;
    const high = value > optHi;
    const low = value < optLo;

    switch (parameter) {
      case 'temp':
        return high
          ? 'Температура высокая, сбавьте скорость.'
          : 'Двигатель слишком холодный.';
      case 'pressure':
        return high ? 'Давление слишком высокое.' : 'Давление слишком низкое.';
      case 'fuel':
        return low
          ? 'Низкий уровень топлива; немедленно заправьтесь.'
          : 'Избыток топлива.';
      case 'speed':
        return high ? 'Скорость опасно высока.' : 'Скорость необычно низкая.';
      case 'brake':
        return 'Эффективность торможения ухудшается.';
      case 'engine':
        return 'Ухудшается работа двигателя.';
      default:
        return `Параметр ${parameter} нуждается во внимании.`;
    }
  }

  getConfig(): HealthConfig {
    return this.config;
  }
}
