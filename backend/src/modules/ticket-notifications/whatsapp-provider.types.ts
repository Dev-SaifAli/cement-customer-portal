export interface WhatsAppMessage {
  phoneNumber: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export type WhatsAppSendResult =
  | {
      ok: true;
      provider: string;
      messageId?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      ok: false;
      provider: string;
      reason: 'DISABLED' | 'NOT_CONFIGURED' | 'FAILED';
      message: string;
      metadata?: Record<string, unknown>;
    };

export interface WhatsAppProvider {
  readonly name: string;
  isEnabled(): boolean;
  sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult>;
}
