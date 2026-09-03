import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { WhatsAppMessage, WhatsAppProvider, WhatsAppSendResult } from './whatsapp-provider.types.js';

export class PendingWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'pending-whatsapp-provider';

  isEnabled() {
    return env.WHATSAPP_ENABLED;
  }

  async sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    if (!this.isEnabled()) {
      logger.info(
        {
          provider: this.name,
          phoneNumber: message.phoneNumber,
        },
        'WhatsApp notification skipped because WHATSAPP_ENABLED is false.',
      );
      return {
        ok: false,
        provider: this.name,
        reason: 'DISABLED',
        message: 'WhatsApp notifications are disabled.',
      };
    }

    logger.warn(
      {
        provider: this.name,
        phoneNumber: message.phoneNumber,
      },
      'WhatsApp notification skipped because no WhatsApp provider is configured.',
    );
    return {
      ok: false,
      provider: this.name,
      reason: 'NOT_CONFIGURED',
      message: 'WhatsApp provider is not configured.',
    };
  }
}

export const pendingWhatsAppProvider = new PendingWhatsAppProvider();
