import type { PoolClient } from 'pg';

type DocumentPrefix = 'DO' | 'RFQ' | 'CT';
type SequenceName =
  | 'order_reference_seq'
  | 'customer_quotation_reference_seq'
  | 'contract_reference_seq';

export async function nextDocumentReference(
  client: PoolClient,
  sequenceName: SequenceName,
  prefix: DocumentPrefix,
) {
  const result = await client.query<{ sequence: string }>(
    `select nextval('${sequenceName}')::text as sequence`,
  );
  const sequence = String(result.rows[0]?.sequence ?? '1').padStart(6, '0');

  return `${prefix}${shortYear()}${sequence}`;
}

export async function nextContractOrderReference(client: PoolClient) {
  const result = await client.query<{ sequence: string }>(
    `select nextval('order_reference_seq')::text as sequence`,
  );
  const sequence = String(result.rows[0]?.sequence ?? '1').padStart(6, '0');

  return `ORD${shortYear()}${sequence}`;
}

export async function nextDeliveryRequestReference(client: PoolClient) {
  const result = await client.query<{ sequence: string }>(
    `select nextval('delivery_request_number_seq')::text as sequence`,
  );
  const sequence = String(result.rows[0]?.sequence ?? '1').padStart(6, '0');

  return `DR${shortYear()}${sequence}`;
}

export async function nextShipmentReference(
  client: PoolClient,
  contractId: string | null,
  contractReference: string | null,
) {
  if (!contractId || !contractReference) {
    const result = await client.query<{ sequence: string }>(
      `select nextval('shipment_number_seq')::text as sequence`,
    );
    const sequence = String(result.rows[0]?.sequence ?? '1').padStart(6, '0');
    return `SHP${shortYear()}${sequence}`;
  }

  const result = await client.query<{ suffix: number }>(
    `insert into contract_shipment_number_counters (contract_id, last_suffix)
     values ($1, 1)
     on conflict (contract_id)
     do update set last_suffix = contract_shipment_number_counters.last_suffix + 1,
                   updated_at = now()
     returning last_suffix as suffix`,
    [contractId],
  );
  const suffix = result.rows[0]?.suffix ?? 1;

  return `${compactContractReference(contractReference)}_${suffix}`;
}

function shortYear(date = new Date()) {
  return String(date.getFullYear()).slice(-2);
}

function compactContractReference(reference: string) {
  const legacyMatch = /^CT-(\d{4})-(\d{6})$/.exec(reference);
  if (!legacyMatch) return reference;
  const [, year, sequence] = legacyMatch;
  if (!year || !sequence) return reference;

  return `CT${year.slice(-2)}${sequence}`;
}
