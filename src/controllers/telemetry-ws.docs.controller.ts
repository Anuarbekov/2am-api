import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiProperty,
} from '@nestjs/swagger';

export class TelemetryEffectiveDocDto {
  @ApiProperty({ example: 72.5 })
  temp: number;

  @ApiProperty({ example: 101.32 })
  pressure: number;

  @ApiProperty({ example: 4500 })
  fuel: number;

  @ApiProperty({ example: 85 })
  speed: number;

  @ApiProperty({ example: 62 })
  engine: number;

  @ApiProperty({ example: 0 })
  brake: number;
}

export class HealthFactorDocDto {
  @ApiProperty({ example: 'temp' })
  parameter: string;

  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: 'Within nominal range' })
  message: string;
}

export class HealthResultDocDto {
  @ApiProperty({ example: 0.87 })
  score: number;

  @ApiProperty({ example: 'B' })
  grade: string;

  @ApiProperty({ type: HealthFactorDocDto, isArray: true })
  factors: HealthFactorDocDto[];
}

/** Payload for one processed telemetry row. */
export class TelemetryResponseDocDto {
  @ApiProperty({ example: '2026-04-05T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ type: TelemetryEffectiveDocDto })
  effective: TelemetryEffectiveDocDto;

  @ApiProperty({ type: HealthResultDocDto })
  healthIndex: HealthResultDocDto;
}

@ApiTags('WebSocket · Telemetry data')
@Controller('ws/telemetry')
export class TelemetryWsDocsController {
  @Get()
  @ApiOperation({
    summary: 'WebSocket endpoints for telemetry data',
    description: `
| WebSocket path | Query | Data shape |
| --- | --- | --- |
| \`/ws/telemetry\` | Optional \`from\`, \`to\` (ISO-8601) | One **TelemetryResponse** per message (see \`GET …/data/row\`) |
| \`/ws/telemetry/history\` | Required \`from\`, \`to\` | Same as above |
| \`/ws/telemetry/requestReplay\` | Required \`seconds\` (1–900) | **TelemetryResponse[]** per message — one array per non-empty minute (see \`GET …/data/batch\`) |
    `,
  })
  overview() {
    return { ok: true };
  }
}
