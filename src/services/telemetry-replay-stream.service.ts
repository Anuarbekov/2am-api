import { Injectable, Logger } from '@nestjs/common';
import { RawTelemetryService } from './raw-telemetry.service';
import { HealthIndexService} from './health-index.service';
import {
  TelemetryResponse,
  toTelemetryResponse,
} from '../interfaces/telemetry-response.interface';
import { ProcessedTelemetry } from './signal-processing.service';

export type TelemetryEmitFn = (event: string, data: unknown) => void;

@Injectable()
export class TelemetryReplayStreamService {
  private readonly logger = new Logger(TelemetryReplayStreamService.name);

  constructor(
    private readonly rawTelemetryService: RawTelemetryService,
    private readonly healthIndexService: HealthIndexService,
  ) {}

  async start(
    emit: TelemetryEmitFn,
    intervalMs: number,
    logLabel: string,
    range?: { from: Date; to: Date },
    historyOptions?: { smooth?: boolean },
  ): Promise<() => void> {
    const from = range?.from ?? new Date(0);
    const to = range?.to ?? new Date();

    emit('connected', {
      message: range
        ? `Connected — streaming ${from.toISOString()} … ${to.toISOString()}`
        : 'Connected — streaming oldest to newest telemetry',
      range: range
        ? { from: from.toISOString(), to: to.toISOString() }
        : undefined,
    });

    let allData: ProcessedTelemetry[];
    try {
      allData = await this.rawTelemetryService.getProcessedHistory(
        from,
        to,
        historyOptions,
      );
    } catch (error) {
      this.logger.error(`Failed to load telemetry (${logLabel})`, error);
      emit('error', { message: 'Failed to load telemetry data' });
      return () => {};
    }

    this.logger.log(`Loaded ${allData.length} records for ${logLabel}`);

    if (allData.length === 0) {
      emit('no-data', {
        message: 'No telemetry data available in database',
      });
      return () => {};
    }

    let dataIndex = 0;
    let streamInterval: NodeJS.Timeout | undefined;

    const stop = () => {
      if (streamInterval !== undefined) {
        clearInterval(streamInterval);
        streamInterval = undefined;
      }
    };

    const sendNext = async () => {
      if (dataIndex >= allData.length) {
        return;
      }
      try {
        const data = allData[dataIndex];
        const health = this.healthIndexService.computeHealthFromProcessed(data);
        const payload: TelemetryResponse = toTelemetryResponse(data, health);

        emit('telemetry', payload);
        emit('stream-progress', {
          current: dataIndex + 1,
          total: allData.length,
          percentage: (
            ((dataIndex + 1) / allData.length) *
            100
          ).toFixed(2),
        });

        this.logger.debug(
          `Sent record ${dataIndex + 1}/${allData.length} (${logLabel})`,
        );

        dataIndex++;
      } catch (error) {
        this.logger.error(`Error sending record (${logLabel})`, error);
        emit('error', { message: 'Error processing telemetry record' });
      }
    };

    await sendNext();

    streamInterval = setInterval(async () => {
      if (dataIndex >= allData.length) {
        emit('stream-complete', {
          message: 'All telemetry data has been streamed',
          totalRecords: allData.length,
        });
        stop();
        return;
      }
      await sendNext();
    }, intervalMs);

    return stop;
  }
}
