import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import {
  nextContractOrderReference,
  nextDeliveryRequestReference,
  nextDocumentReference,
  nextShipmentReference,
} from './document-numbering.service.js';

describe('document numbering service', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates dynamic-year Direct Order numbers from a database sequence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-15T12:00:00.000Z'));
    const client = mockClient([{ sequence: '1' }]);

    await expect(nextDocumentReference(client, 'order_reference_seq', 'DO')).resolves.toBe(
      'DO27000001',
    );
    expect(client.query).toHaveBeenCalledWith(
      "select nextval('order_reference_seq')::text as sequence",
    );
  });

  it('generates RFQ and Contract numbers with independent prefixes and padded sequences', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T12:00:00.000Z'));
    const client = mockClient([{ sequence: '16' }, { sequence: '2' }]);

    await expect(
      nextDocumentReference(client, 'customer_quotation_reference_seq', 'RFQ'),
    ).resolves.toBe('RFQ26000016');
    await expect(nextDocumentReference(client, 'contract_reference_seq', 'CT')).resolves.toBe(
      'CT26000002',
    );
  });

  it('uses the database sequence result for sequential duplicate-safe document numbers', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T12:00:00.000Z'));
    const client = mockClient([{ sequence: '17' }, { sequence: '18' }]);

    await expect(nextDocumentReference(client, 'order_reference_seq', 'DO')).resolves.toBe(
      'DO26000017',
    );
    await expect(nextDocumentReference(client, 'order_reference_seq', 'DO')).resolves.toBe(
      'DO26000018',
    );
  });

  it('generates contract-based Order numbers with ORDYY sequence format', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-15T12:00:00.000Z'));
    const client = mockClient([{ sequence: '19' }]);

    await expect(nextContractOrderReference(client)).resolves.toBe('ORD27000019');
    expect(client.query).toHaveBeenCalledWith(
      "select nextval('order_reference_seq')::text as sequence",
    );
  });

  it('generates Delivery Request numbers with compact DRYY sequence format', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T12:00:00.000Z'));
    const client = mockClient([{ sequence: '12' }]);

    await expect(nextDeliveryRequestReference(client)).resolves.toBe('DR26000012');
    expect(client.query).toHaveBeenCalledWith(
      "select nextval('delivery_request_number_seq')::text as sequence",
    );
  });

  it('generates shipment numbers from the parent contract and increments suffixes per contract', async () => {
    const client = mockClient([{ suffix: 1 }, { suffix: 2 }]);

    await expect(
      nextShipmentReference(client, '33333333-3333-4333-8333-333333333333', 'CT26000001'),
    ).resolves.toBe('CT26000001_1');
    await expect(
      nextShipmentReference(client, '33333333-3333-4333-8333-333333333333', 'CT26000001'),
    ).resolves.toBe('CT26000001_2');

    expect(String(client.query.mock.calls[0]?.[0])).toContain(
      'insert into contract_shipment_number_counters',
    );
  });

  it('does not reuse shipment suffixes because the database counter only increments upward', async () => {
    const client = mockClient([{ suffix: 4 }]);

    await expect(
      nextShipmentReference(client, '33333333-3333-4333-8333-333333333333', 'CT26000001'),
    ).resolves.toBe('CT26000001_4');
  });

  it('compacts legacy Contract references before appending Shipment suffixes', async () => {
    const client = mockClient([{ suffix: 1 }]);

    await expect(
      nextShipmentReference(client, '33333333-3333-4333-8333-333333333333', 'CT-2026-000007'),
    ).resolves.toBe('CT26000007_1');
  });
});

function mockClient(rows: Array<Record<string, unknown>>) {
  const query = vi.fn().mockImplementation(() => {
    const row = rows.shift();
    return Promise.resolve({ rows: row ? [row] : [] });
  });

  return { query } as unknown as PoolClient & { query: typeof query };
}
