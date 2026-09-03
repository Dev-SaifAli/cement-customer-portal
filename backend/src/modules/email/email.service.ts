import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class EmailService {
  private transporter: Transporter | null = null;

  isConfigured() {
    return Boolean(env.EMAIL_ENABLED && env.SMTP_HOST && env.SMTP_PORT && env.EMAIL_FROM);
  }

  async sendEmail(message: EmailMessage) {
    if (!this.isConfigured()) {
      logger.debug(
        {
          to: message.to,
          subject: message.subject,
        },
        'Email notification skipped because SMTP is not configured.',
      );
      return { skipped: true };
    }

    await this.getTransporter().sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });

    return { skipped: false };
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && env.SMTP_PASSWORD
        ? {
            auth: {
              user: env.SMTP_USER,
              pass: env.SMTP_PASSWORD,
            },
          }
        : {}),
    });

    return this.transporter;
  }
}

export const emailService = new EmailService();
