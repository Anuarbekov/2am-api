import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { RawTelemetryService } from '../services/raw-telemetry.service';
import {
  HealthIndexService,
  HealthResult,
} from '../services/health-index.service';
import { ProcessedTelemetry } from '../services/signal-processing.service';

interface ClientInfo {
  lastTimestamp: Date;
  streamInterval?: NodeJS.Timeout;
}

interface TelemetryEvent {
  type: 'current' | 'update';
  data: ProcessedTelemetry;
  health: HealthResult;
  processed: boolean;
  timestamp: Date;
  processingInfo?: {
    smoothed: boolean;
    confidence: number;
    quality: number;
  };
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'telemetry',
  transports: ['websocket'],
})
@Injectable()
export class TelemetryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TelemetryGateway.name);
  private clients: Map<string, ClientInfo> = new Map();
  private lastSentData: Map<string, ProcessedTelemetry> = new Map();

  constructor(
    private rawTelemetryService: RawTelemetryService,
    private healthIndexService: HealthIndexService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(`Client connected: ${client.id}`);

    const lastTimestamp =
      (await this.rawTelemetryService.getLatestTimestamp()) || new Date();
    this.clients.set(client.id, { lastTimestamp });

    await this.sendLatestProcessedData(client);
    this.startProcessedStream(client);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    const clientData = this.clients.get(client.id);
    if (clientData?.streamInterval) {
      clearInterval(clientData.streamInterval);
    }
    this.clients.delete(client.id);
    this.lastSentData.delete(client.id);
  }

  private async sendLatestProcessedData(client: Socket): Promise<void> {
    const latest = await this.rawTelemetryService.getProcessedTelemetry(
      new Date(Date.now() - 10000),
      1,
    );

    if (latest.length > 0) {
      const health = this.healthIndexService.computeHealthFromProcessed(
        latest[0],
      );
      const event: TelemetryEvent = {
        type: 'current',
        data: latest[0],
        health,
        processed: true,
        timestamp: new Date(),
      };
      client.emit('telemetry', event);
      this.lastSentData.set(client.id, latest[0]);
    }
  }

  private startProcessedStream(client: Socket): void {
    let lastTimestamp =
      this.clients.get(client.id)?.lastTimestamp || new Date();
    let consecutiveErrors = 0;

    const interval = setInterval(async () => {
      try {
        const checkTime = new Date(lastTimestamp.getTime() - 1000);
        const newData = await this.rawTelemetryService.getProcessedTelemetry(
          checkTime,
          50,
        );

        if (newData.length > 0) {
          for (const data of newData) {
            const lastData = this.lastSentData.get(client.id);
            if (
              lastData &&
              lastData.timestamp.getTime() === data.timestamp.getTime()
            ) {
              continue;
            }

            const health =
              this.healthIndexService.computeHealthFromProcessed(data);
            const event: TelemetryEvent = {
              type: 'update',
              data,
              health,
              processed: true,
              timestamp: new Date(),
              processingInfo: {
                smoothed: true,
                confidence: data.confidence,
                quality: data.quality,
              },
            };

            client.emit('telemetry', event);
            this.lastSentData.set(client.id, data);
            lastTimestamp = data.timestamp;
          }
          consecutiveErrors = 0;
        } else {
          client.emit('ping', { timestamp: new Date() });
        }
      } catch (error) {
        consecutiveErrors++;
        this.logger.error(`Stream error for client ${client.id}:`, error);

        if (consecutiveErrors > 5) {
          client.emit('error', { message: 'Stream processing failed' });
        }
      }
    }, 1000);

    const clientData = this.clients.get(client.id);
    if (clientData) {
      clientData.streamInterval = interval;
      this.clients.set(client.id, clientData);
    }
  }

  @SubscribeMessage('requestHistory')
  async handleHistory(
    client: Socket,
    payload: { minutes: number },
  ): Promise<void> {
    const minutes = payload.minutes || 15;
    const to = new Date();
    const from = new Date(to.getTime() - minutes * 60 * 1000);

    const history = await this.rawTelemetryService.getProcessedHistory(
      from,
      to,
      {
        smooth: true,
      },
    );

    const historyWithHealth = history.map((data) => ({
      ...data,
      health: this.healthIndexService.computeHealthFromProcessed(data),
    }));

    client.emit('history', {
      from,
      to,
      data: historyWithHealth,
      count: historyWithHealth.length,
    });
  }

  @SubscribeMessage('requestReplay')
  async handleReplay(
    client: Socket,
    payload: { from: string; to: string },
  ): Promise<void> {
    const from = new Date(payload.from);
    const to = new Date(payload.to);

    const replay = await this.rawTelemetryService.getProcessedHistory(from, to);

    const replayWithHealth = replay.map((data) => ({
      ...data,
      health: this.healthIndexService.computeHealthFromProcessed(data),
    }));

    client.emit('replay', {
      from,
      to,
      data: replayWithHealth,
    });
  }
}
