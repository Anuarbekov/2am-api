import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { IncomingMessage, Server as HttpServer } from 'http';
import { Socket } from 'net';
import { WebSocketServer, WebSocket } from 'ws';
import { TelemetryReplayStreamService } from './telemetry-replay-stream.service';

const MAX_REPLAY_SECONDS = 900;
const REPLAY_BATCH_INTERVAL_MS = 60_000;

type RawWsMode = 'default' | 'history' | 'replaySeconds';

@Injectable()
export class TelemetryRawWsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryRawWsService.name);
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private upgradeHandler:
    | ((request: IncomingMessage, socket: Socket, head: Buffer) => void)
    | null = null;
  private seq = 0;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly replayStream: TelemetryReplayStreamService,
  ) {}

  onModuleInit() {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
    this.httpServer = httpServer;

    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      void this.handleConnection(ws, req);
    });

    this.upgradeHandler = (
      request: IncomingMessage,
      socket: Socket,
      head: Buffer,
    ) => {
      let pathname: string;
      try {
        const host = request.headers.host ?? '127.0.0.1';
        pathname = new URL(request.url || '/', `http://${host}`).pathname;
      } catch {
        return;
      }

      if (
        pathname === '/ws/telemetry/history' ||
        pathname === '/ws/telemetry/requestReplay' ||
        pathname === '/ws/telemetry'
      ) {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      }
    };

    httpServer.on('upgrade', this.upgradeHandler);

    this.logger.log(
      'Raw WebSocket: /ws/telemetry[?from=&to=], /ws/telemetry/history?from=&to=, /ws/telemetry/requestReplay?seconds= (max 900, batches every 1 min)',
    );
  }

  onModuleDestroy() {
    if (this.httpServer && this.upgradeHandler) {
      this.httpServer.removeListener('upgrade', this.upgradeHandler);
    }
    this.upgradeHandler = null;
    this.httpServer = null;

    this.wss?.close();
    this.wss = null;
  }

  private getMode(req: IncomingMessage): RawWsMode {
    const host = req.headers.host ?? '127.0.0.1';
    const pathname = new URL(req.url || '/', `http://${host}`).pathname;
    if (pathname === '/ws/telemetry/history') return 'history';
    if (pathname === '/ws/telemetry/requestReplay') return 'replaySeconds';
    return 'default';
  }

  private parseRange(
    req: IncomingMessage,
  ): { from: Date; to: Date } | null | 'invalid' {
    const host = req.headers.host ?? '127.0.0.1';
    let real: URL;
    try {
      real = new URL(req.url || '/', `http://${host}`);
    } catch {
      return 'invalid';
    }
    const fromS = real.searchParams.get('from');
    const toS = real.searchParams.get('to');
    if (!fromS || !toS) {
      return null;
    }
    const from = new Date(fromS);
    const to = new Date(toS);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return 'invalid';
    }
    return { from, to };
  }

  private parseSeconds(req: IncomingMessage): number | null | 'invalid' {
    const host = req.headers.host ?? '127.0.0.1';
    let real: URL;
    try {
      real = new URL(req.url || '/', `http://${host}`);
    } catch {
      return 'invalid';
    }
    const raw = real.searchParams.get('seconds');
    if (raw === null || raw === '') {
      return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return 'invalid';
    }
    return Math.min(Math.floor(n), MAX_REPLAY_SECONDS);
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    const mode = this.getMode(req);
    const id = `raw-ws-${++this.seq}`;
    this.logger.log(`Raw WS client: ${id} (${mode})`);

    const send = (event: string, data: unknown) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }
      ws.send(JSON.stringify({ event, data }));
    };

    let range: { from: Date; to: Date } | undefined;
    let historyOptions: { smooth?: boolean } | undefined;

    if (mode === 'history') {
      const parsed = this.parseRange(req);
      if (parsed === null) {
        send('error', {
          message:
            'Required: ?from=ISO&to=ISO e.g. ?from=2026-04-04T17:00:00.000Z&to=2026-04-04T17:00:20.000Z',
        });
        ws.close();
        return;
      }
      if (parsed === 'invalid') {
        send('error', {
          message: 'Invalid from/to — use ISO-8601 in the query string',
        });
        ws.close();
        return;
      }
      range = parsed;
    } else if (mode === 'replaySeconds') {
      const seconds = this.parseSeconds(req);
      if (seconds === null) {
        send('error', {
          message:
            'Required: ?seconds=N (1–' +
            MAX_REPLAY_SECONDS +
            ') e.g. ?seconds=60',
        });
        ws.close();
        return;
      }
      if (seconds === 'invalid') {
        send('error', { message: 'Invalid seconds — use a positive number' });
        ws.close();
        return;
      }
      const to = new Date();
      const from = new Date(to.getTime() - seconds * 1000);
      range = { from, to };
      historyOptions = { smooth: true };
    } else {
      const parsed = this.parseRange(req);
      if (parsed === 'invalid') {
        send('error', {
          message: 'Invalid from/to — use ISO-8601 in the query string',
        });
        ws.close();
        return;
      }
      if (parsed) {
        range = parsed;
      }
    }

    const stop =
      mode === 'replaySeconds' && range
        ? await this.replayStream.startBatchedByMinute(
            send,
            REPLAY_BATCH_INTERVAL_MS,
            id,
            range,
            historyOptions,
          )
        : await this.replayStream.start(
            send,
            1000,
            id,
            range,
            historyOptions,
          );

    const dispose = () => {
      stop();
      ws.removeListener('close', dispose);
      ws.removeListener('error', dispose);
    };
    ws.once('close', dispose);
    ws.once('error', dispose);
  }
}
