import { describe, expect, it } from 'vitest';
import {
  customerQuotationDecisionMessageSchema,
  listCustomerQuotationsSchema,
} from './customer-quotations.validation.js';

describe('customer quotation list validation', () => {
  it('accepts supported filters and normalizes pagination', () => {
    expect(
      listCustomerQuotationsSchema.parse({
        page: '2',
        reference: ' QT-2026 ',
        createdDate: '2026-08-24',
        requestedDate: '2026-08-30',
        fulfilmentType: 'DELIVERY',
        deliveryLocation: ' Jeddah ',
        status: 'PENDING_SALES_REVIEW',
      }),
    ).toEqual({
      page: 2,
      reference: 'QT-2026',
      createdDate: '2026-08-24',
      requestedDate: '2026-08-30',
      fulfilmentType: 'DELIVERY',
      deliveryLocation: 'Jeddah',
      status: 'PENDING_SALES_REVIEW',
    });
  });

  it('rejects unsupported status filters', () => {
    expect(() => listCustomerQuotationsSchema.parse({ status: 'INTERNAL_ONLY' })).toThrow();
  });
});

describe('customer quotation decision validation', () => {
  it('trims a valid customer reason', () => {
    expect(
      customerQuotationDecisionMessageSchema.parse({ reason: '  Please revise delivery.  ' }),
    ).toEqual({ reason: 'Please revise delivery.' });
  });

  it('rejects an empty customer reason', () => {
    expect(() => customerQuotationDecisionMessageSchema.parse({ reason: ' ' })).toThrow();
  });
});
