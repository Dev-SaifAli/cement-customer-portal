import { logger } from '../../config/logger.js';
import { vasOrderAdapter } from './vas.adapter.js';
import { vasOutboxRepository } from './vas-outbox.repository.js';
import type { VasErrorCategory, VasOrderAggregate } from './vas.types.js';

export class VasIntegrationService {
  prepareOrder(aggregate: VasOrderAggregate) {
    return vasOrderAdapter.map(aggregate);
  }

  async recordPreparedOrder(
    aggregate: VasOrderAggregate,
    input: { eventType: string; correlationKey: string },
  ) {
    const mapping = this.prepareOrder(aggregate);
    const validationError = mapping.valid
      ? undefined
      : mapping.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    const record = await vasOutboxRepository.create({
      orderId: aggregate.order.id,
      eventType: input.eventType,
      payloadSnapshot: mapping,
      correlationKey: input.correlationKey,
      ...(validationError
        ? { status: 'VALIDATION_FAILED' as const, validationError }
        : { status: 'PENDING' as const }),
    });

    logger.info(
      {
        correlationId: input.correlationKey,
        orderId: aggregate.order.id,
        orderReference: aggregate.order.orderNumber,
        integrationEvent: input.eventType,
        status: record?.status ?? 'NOT_RECORDED',
      },
      'VAS order mapping recorded',
    );
    return record;
  }

  async recordAttempt(outboxId: string, context: IntegrationLogContext) {
    const record = await vasOutboxRepository.markAttempt(outboxId);
    this.logState('VAS transmission attempt recorded', record, context);
    return record;
  }

  async recordSuccess(
    outboxId: string,
    externalReference: string | null,
    context: IntegrationLogContext,
  ) {
    const record = await vasOutboxRepository.markSucceeded(outboxId, externalReference);
    this.logState('VAS transmission succeeded', record, context);
    return record;
  }

  async recordFailure(
    outboxId: string,
    category: VasErrorCategory,
    safeError: string,
    context: IntegrationLogContext,
  ) {
    const record = await vasOutboxRepository.markFailed(outboxId, category, safeError);
    this.logState('VAS transmission failed', record, context);
    return record;
  }

  private logState(
    message: string,
    record: Awaited<ReturnType<typeof vasOutboxRepository.markAttempt>>,
    context: IntegrationLogContext,
  ) {
    logger.info(
      {
        correlationId: context.correlationKey,
        orderId: context.orderId,
        integrationEvent: context.eventType,
        attempt: record?.attemptCount ?? null,
        status: record?.status ?? 'NOT_FOUND',
      },
      message,
    );
  }
}

export const vasIntegrationService = new VasIntegrationService();

interface IntegrationLogContext {
  correlationKey: string;
  orderId: string;
  eventType: string;
}
