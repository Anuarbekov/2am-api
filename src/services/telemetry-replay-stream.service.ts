import { Injectable, Logger } from '@nestjs/common';
import { RawTelemetryService } from './raw-telemetry.service';
import { HealthIndexService } from './health-index.service';
import {
  TelemetryResponse,
  toTelemetryResponse,
} from '../interfaces/telemetry-response.interface';
import { ProcessedTelemetry } from './signal-processing.service';

export type TelemetryEmitFn = (event: string, data: unknown) => void;

const DATA_MINUTE_MS = 60_000;

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
          percentage: (((dataIndex + 1) / allData.length) * 100).toFixed(2),
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

  async startBatchedByMinute(
    emit: TelemetryEmitFn,
    batchIntervalMs: number,
    logLabel: string,
    range: { from: Date; to: Date },
    historyOptions?: { smooth?: boolean },
  ): Promise<() => void> {
    const { from, to } = range;

    emit('connected', {
      message: `Connected — replay by 1-minute batches ${from.toISOString()} … ${to.toISOString()}`,
      range: { from: from.toISOString(), to: to.toISOString() },
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

    const fromMs = from.getTime();
    const toMs = to.getTime();
    const windowMs = Math.max(0, toMs - fromMs);
    const numSlots = Math.max(1, Math.ceil(windowMs / DATA_MINUTE_MS));

    this.logger.debug(
      `Range: ${from.toISOString()} → ${to.toISOString()}, windowMs=${windowMs}, numSlots=${numSlots}`,
    );

    const slots: ProcessedTelemetry[][] = Array.from(
      { length: numSlots },
      () => [],
    );

    let skipped = 0;
    for (const d of allData) {
      const t = d.timestamp.getTime();

      if (t < fromMs || t > toMs) {
        this.logger.warn(
          `Record at ${d.timestamp.toISOString()} is outside range ` +
            `[${from.toISOString()}, ${to.toISOString()}] — skipping`,
        );
        skipped++;
        continue;
      }

      const slot = Math.min(
        numSlots - 1,
        Math.floor((t - fromMs) / DATA_MINUTE_MS),
      );

      this.logger.debug(
        `Record at ${d.timestamp.toISOString()} → slot ${slot}/${numSlots - 1}`,
      );

      slots[slot].push(d);
    }

    const batches: { slotIndex: number; data: TelemetryResponse[] }[] = slots
      .map((chunk, slotIndex) => ({
        slotIndex,
        data: chunk.map((row) =>
          toTelemetryResponse(
            row,
            this.healthIndexService.computeHealthFromProcessed(row),
          ),
        ),
      }))
      .filter((b) => b.data.length > 0);

    if (batches.length === 0) {
      emit('no-data', {
        message: 'No telemetry data available in the requested window',
      });
      return () => {};
    }

    let batchIndex = 0;
    let streamInterval: NodeJS.Timeout | undefined;

    const stop = () => {
      if (streamInterval !== undefined) {
        clearInterval(streamInterval);
        streamInterval = undefined;
      }
    };

    const sendNext = () => {
      if (batchIndex >= batches.length) {
        return;
      }

      const { slotIndex, data } = batches[batchIndex];
      const minuteStart = new Date(fromMs + slotIndex * DATA_MINUTE_MS);

      emit('replay', data);
      emit('stream-progress', {
        current: batchIndex + 1,
        total: batches.length,
        percentage: (((batchIndex + 1) / batches.length) * 100).toFixed(2),
        minuteStart: minuteStart.toISOString(),
        slotIndex,
      });

      batchIndex++;

      if (batchIndex >= batches.length) {
        emit('stream-complete', {
          message: 'Replay finished',
          totalBatches: batches.length,
        });
        stop();
      }
    };

    sendNext();

    if (batchIndex < batches.length) {
      streamInterval = setInterval(sendNext, batchIntervalMs);
    }

    return stop;
  }
}
