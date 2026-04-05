import { HealthResult } from './health-result.interface';
import { ProcessedTelemetry } from '../services/signal-processing.service';

export interface TelemetryResponse {
  timestamp: Date;
  effective: {
    temp: number;
    pressure: number;
    fuel: number;
    speed: number;
    engine: number;
    brake: number;
  };
  healthIndex: HealthResult;
}

export function toTelemetryResponse(
  data: ProcessedTelemetry,
  health: HealthResult,
): TelemetryResponse {
  return {
    timestamp: data.timestamp,
    effective: {
      temp: data.temp,
      pressure: data.pressure,
      fuel: data.fuel,
      speed: data.speed,
      engine: data.engine,
      brake: data.brake,
    },
    healthIndex: health,
  };
}
