import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SignalProcessingService } from '../services/signal-processing.service';

@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  constructor(private signalProcessing: SignalProcessingService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupSignalProcessing() {
    this.logger.debug('Cleaning up signal processing state');
    this.signalProcessing.cleanup(60000);
  }
}
