import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RawTelemetryService } from '../services/raw-telemetry.service';
import {
  HealthIndexService,
  HealthResult,
} from '../services/health-index.service';
import { ProcessedTelemetry } from '../services/signal-processing.service';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('telemetry')
@Controller('api/telemetry')
export class TelemetryController {
  constructor(
    private rawTelemetryService: RawTelemetryService,
    private healthIndexService: HealthIndexService,
  ) {}

  @Get('oldest')
  @ApiOperation({ summary: 'Get oldest telemetry' })
  @ApiResponse({
    status: 200,
    description: 'Returns oldest telemetry with health index',
  })
  async getOldest(): Promise<
    { data: ProcessedTelemetry; health: HealthResult } | { error: string }
  > {
    const data = await this.rawTelemetryService.getOldestProcessed();
    if (!data) {
      return { error: 'No data found' };
    }
    const health = this.healthIndexService.computeHealthFromProcessed(data);
    return { data, health };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get telemetry history' })
  @ApiQuery({ name: 'from', required: true, type: String })
  @ApiQuery({ name: 'to', required: true, type: String })
  async getHistory(
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<{
    from: string;
    to: string;
    count: number;
    data: Array<ProcessedTelemetry & { health: HealthResult }>;
  }> {
    const data = await this.rawTelemetryService.getProcessedHistory(
      new Date(from),
      new Date(to),
      { smooth: true },
    );

    const dataWithHealth = data.map((item) => ({
      ...item,
      health: this.healthIndexService.computeHealthFromProcessed(item),
    }));

    return { from, to, count: dataWithHealth.length, data: dataWithHealth };
  }

  @Get('health/config')
  @ApiOperation({ summary: 'Get health index configuration' })
  getHealthConfig() {
    return this.healthIndexService.getConfig();
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export telemetry to CSV' })
  async exportCsv(
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.rawTelemetryService.getProcessedHistory(
      new Date(from),
      new Date(to),
    );

    let csv = 'timestamp,fuel,pressure,temp,speed,health_index,health_grade\n';
    for (const row of data) {
      const health = this.healthIndexService.computeHealthFromProcessed(row);
      csv += `${row.timestamp},${row.fuel},${row.pressure},${row.temp},${row.speed},${health.index},${health.grade}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=telemetry_${Date.now()}.csv`,
    );
    res.send(csv);
  }
}
