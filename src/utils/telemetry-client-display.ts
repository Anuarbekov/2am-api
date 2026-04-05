import { HealthResult } from '../interfaces/health-result.interface';
import { ProcessedTelemetry } from '../services/signal-processing.service';

export function roundTelemetryNumber(n: number): number {
  return Number(n.toFixed(2));
}

export function roundProcessedTelemetryForClient(
  data: ProcessedTelemetry,
): ProcessedTelemetry {
  return {
    ...data,
    fuel: roundTelemetryNumber(data.fuel),
    pressure: roundTelemetryNumber(data.pressure),
    temp: roundTelemetryNumber(data.temp),
    speed: roundTelemetryNumber(data.speed),
    quality: roundTelemetryNumber(data.quality),
    brake: roundTelemetryNumber(data.brake),
    engine: roundTelemetryNumber(data.engine),
    confidence: roundTelemetryNumber(data.confidence),
  };
}

export function roundHealthForClient(health: HealthResult): HealthResult {
  return {
    ...health,
    score: roundTelemetryNumber(health.score),
  };
}
