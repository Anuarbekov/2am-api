import { HealthResult } from './health-result.interface';
import { ProcessedTelemetry } from '../services/signal-processing.service';
import {
  roundHealthForClient,
  roundTelemetryNumber,
} from '../utils/telemetry-client-display';

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
      temp: roundTelemetryNumber(data.temp),
      pressure: roundTelemetryNumber(data.pressure),
      fuel: roundTelemetryNumber(data.fuel),
      speed: roundTelemetryNumber(data.speed),
      engine: roundTelemetryNumber(data.engine),
      brake: roundTelemetryNumber(data.brake),
    },
    healthIndex: roundHealthForClient(health),
  };
}
