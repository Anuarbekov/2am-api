import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { RawTelemetryService } from '../services/raw-telemetry.service';
import { HealthIndexService } from '../services/health-index.service';
import {
  TelemetryReplayStreamService,
  TELEMETRY_STREAM_MS,
} from '../services/telemetry-replay-stream.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/telemetry',
  transports: ['polling', 'websocket'],
})
@Injectable()
export class TelemetryGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TelemetryGateway.name);
  private readonly stopByClient = new Map<string, () => void>();

  constructor(
    private rawTelemetryService: RawTelemetryService,
    private healthIndexService: HealthIndexService,
    private replayStream: TelemetryReplayStreamService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Socket.IO gateway initialized (namespace /telemetry)');
  }

  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(`Client connected: ${client.id}`);
    const stop = await this.replayStream.start(
      (event, data) => client.emit(event, data),
      TELEMETRY_STREAM_MS,
      client.id,
    );
    this.stopByClient.set(client.id, stop);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.stopByClient.get(client.id)?.();
    this.stopByClient.delete(client.id);
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
