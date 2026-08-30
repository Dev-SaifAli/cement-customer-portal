import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import {
  documentStorageService,
  type DocumentReadStream,
} from '../registration-documents/document-storage.service.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type {
  CreateShipmentPodInput,
  ShipmentPodDocumentType,
} from './hader-pod.validation.js';

interface PodRow {
  id: string;
  shipment_id: string;
  shipment_number: string;
  receiver_name: string;
  delivered_quantity_ton: string;
  delivery_time: Date | string;
  latitude: string | null;
  longitude: string | null;
  evidence_notes: string | null;
  created_by_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PodDocumentRow {
  id: string;
  document_type: ShipmentPodDocumentType;
  original_file_name: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
  created_at: Date | string;
}

export class HaderPodService {
  async create(shipmentId: string, input: CreateShipmentPodInput, actor: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const shipment = await client.query<{ id: string; status: string }>(
        'select id,status from shipments where id=$1 for update',
        [shipmentId],
      );
      if (!shipment.rows[0]) {
        throw new AppError('Shipment was not found.', 404, 'SHIPMENT_NOT_FOUND');
      }
      if (shipment.rows[0].status !== 'DELIVERED') {
        throw new AppError(
          'Proof of delivery can only be created for a delivered shipment.',
          409,
          'SHIPMENT_POD_STATUS_INVALID',
        );
      }
      const existing = await client.query<{ id: string }>(
        'select id from shipment_pods where shipment_id=$1',
        [shipmentId],
      );
      if (existing.rows[0]) {
        throw new AppError(
          'Proof of delivery already exists for this shipment.',
          409,
          'SHIPMENT_POD_ALREADY_EXISTS',
        );
      }
      const result = await client.query<{ id: string }>(
        `insert into shipment_pods
          (shipment_id,receiver_name,delivered_quantity_ton,delivery_time,latitude,longitude,
           evidence_notes,created_by_sales_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [
          shipmentId,
          input.receiver,
          input.deliveredQuantityTon,
          input.deliveryTime,
          input.latitude ?? null,
          input.longitude ?? null,
          input.evidence?.trim() || null,
          actor.id,
        ],
      );
      const podId = result.rows[0]?.id;
      if (!podId) throw new AppError('Proof of delivery could not be created.', 500, 'POD_CREATE_FAILED');
      await addShipmentEvent(client, shipmentId, 'POD_CREATED', actor.id, {
        podId,
        deliveredQuantityTon: input.deliveredQuantityTon,
        deliveryTime: input.deliveryTime,
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      if (isUniqueViolation(error)) {
        throw new AppError(
          'Proof of delivery already exists for this shipment.',
          409,
          'SHIPMENT_POD_ALREADY_EXISTS',
        );
      }
      throw error;
    } finally {
      client.release();
    }
    return this.get(shipmentId);
  }

  async get(shipmentId: string) {
    const result = await pool.query<PodRow>(
      `select pod.id,pod.shipment_id,s.shipment_number,pod.receiver_name,
        pod.delivered_quantity_ton,pod.delivery_time,pod.latitude,pod.longitude,
        pod.evidence_notes,actor.name created_by_name,pod.created_at,pod.updated_at
       from shipment_pods pod
       join shipments s on s.id=pod.shipment_id
       left join sales_users actor on actor.id=pod.created_by_sales_user_id
       where pod.shipment_id=$1`,
      [shipmentId],
    );
    const pod = result.rows[0];
    if (!pod) throw new AppError('Proof of delivery was not found.', 404, 'SHIPMENT_POD_NOT_FOUND');
    const documents = await pool.query<PodDocumentRow>(
      `select id,document_type,original_file_name,storage_key,mime_type,file_size,created_at
       from shipment_pod_documents where pod_id=$1 order by document_type`,
      [pod.id],
    );
    return mapPod(pod, documents.rows);
  }

  async update(shipmentId: string, input: CreateShipmentPodInput, actor: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const shipment = await client.query<{ id: string; status: string }>(
        'select id,status from shipments where id=$1 for update',
        [shipmentId],
      );
      if (!shipment.rows[0]) {
        throw new AppError('Shipment was not found.', 404, 'SHIPMENT_NOT_FOUND');
      }
      if (shipment.rows[0].status !== 'DELIVERED') {
        throw new AppError(
          'Proof of delivery can only be updated for a delivered shipment.',
          409,
          'SHIPMENT_POD_STATUS_INVALID',
        );
      }

      const existing = await client.query<{ id: string }>(
        'select id from shipment_pods where shipment_id=$1 for update',
        [shipmentId],
      );
      const podId = existing.rows[0]?.id;
      if (!podId) {
        throw new AppError(
          'Proof of delivery was not found.',
          404,
          'SHIPMENT_POD_NOT_FOUND',
        );
      }

      await client.query(
        `update shipment_pods set
           receiver_name=$2,delivered_quantity_ton=$3,delivery_time=$4,
           latitude=$5,longitude=$6,evidence_notes=$7,updated_at=now()
         where id=$1`,
        [
          podId,
          input.receiver,
          input.deliveredQuantityTon,
          input.deliveryTime,
          input.latitude ?? null,
          input.longitude ?? null,
          input.evidence?.trim() || null,
        ],
      );
      await addShipmentEvent(client, shipmentId, 'POD_UPDATED', actor.id, {
        podId,
        deliveredQuantityTon: input.deliveredQuantityTon,
        deliveryTime: input.deliveryTime,
        locationUpdated: input.latitude != null && input.longitude != null,
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.get(shipmentId);
  }

  async uploadDocument(
    shipmentId: string,
    documentType: ShipmentPodDocumentType,
    fileName: string,
    mimeType: string | undefined,
    buffer: Buffer,
    actor: SalesUser,
  ) {
    const podResult = await pool.query<{ pod_id: string; status: string }>(
      `select pod.id pod_id,s.status from shipment_pods pod
       join shipments s on s.id=pod.shipment_id where pod.shipment_id=$1`,
      [shipmentId],
    );
    const pod = podResult.rows[0];
    if (!pod) throw new AppError('Proof of delivery was not found.', 404, 'SHIPMENT_POD_NOT_FOUND');
    if (pod.status !== 'DELIVERED') {
      throw new AppError(
        'POD evidence can only be uploaded while the shipment is delivered.',
        409,
        'SHIPMENT_POD_STATUS_INVALID',
      );
    }
    const stored = await documentStorageService.saveShipmentPodDocument({
      shipmentId,
      documentType,
      fileName,
      mimeType,
      buffer,
    });
    const result = await pool.query<PodDocumentRow>(
      `insert into shipment_pod_documents
        (pod_id,document_type,original_file_name,storage_key,mime_type,file_size,
         uploaded_by_sales_user_id)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict(pod_id,document_type) do update set
         original_file_name=excluded.original_file_name,storage_key=excluded.storage_key,
         mime_type=excluded.mime_type,file_size=excluded.file_size,
         uploaded_by_sales_user_id=excluded.uploaded_by_sales_user_id,created_at=now()
       returning *`,
      [
        pod.pod_id,
        documentType,
        stored.originalFileName,
        stored.storageKey,
        stored.mimeType,
        stored.size,
        actor.id,
      ],
    );
    await pool.query(
      `insert into shipment_events
        (shipment_id,event_type,previous_status,new_status,changed_by_sales_user_id,event_data)
       values ($1,'POD_DOCUMENT_UPLOADED','DELIVERED','DELIVERED',$2,$3::jsonb)`,
      [shipmentId, actor.id, JSON.stringify({ documentType, documentId: result.rows[0]?.id })],
    );
    return mapDocument(requireDocument(result.rows[0]));
  }

  async getDocument(
    shipmentId: string,
    documentId: string,
  ): Promise<ReturnType<typeof mapDocument> & DocumentReadStream> {
    const result = await pool.query<PodDocumentRow>(
      `select document.* from shipment_pod_documents document
       join shipment_pods pod on pod.id=document.pod_id
       where document.id=$1 and pod.shipment_id=$2`,
      [documentId, shipmentId],
    );
    const document = requireDocument(result.rows[0]);
    return {
      ...mapDocument(document),
      ...(await documentStorageService.readStoredDocument(document.storage_key)),
    };
  }
}

export const haderPodService = new HaderPodService();

async function addShipmentEvent(
  client: PoolClient,
  shipmentId: string,
  eventType: string,
  actorId: string,
  eventData: Record<string, unknown>,
) {
  await client.query(
    `insert into shipment_events
      (shipment_id,event_type,previous_status,new_status,changed_by_sales_user_id,event_data)
     values ($1,$2,'DELIVERED','DELIVERED',$3,$4::jsonb)`,
    [shipmentId, eventType, actorId, JSON.stringify(eventData)],
  );
}

function mapPod(row: PodRow, documents: PodDocumentRow[]) {
  return {
    id: row.id,
    shipment: { id: row.shipment_id, number: row.shipment_number },
    receiver: row.receiver_name,
    deliveredQuantityTon: Number(row.delivered_quantity_ton),
    deliveryTime: new Date(String(row.delivery_time)).toISOString(),
    location:
      row.latitude !== null && row.longitude !== null
        ? { latitude: Number(row.latitude), longitude: Number(row.longitude) }
        : null,
    evidence: row.evidence_notes,
    documents: documents.map(mapDocument),
    createdBy: row.created_by_name ?? 'Internal user',
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapDocument(row: PodDocumentRow) {
  return {
    id: row.id,
    documentType: row.document_type,
    fileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    uploadedAt: new Date(String(row.created_at)).toISOString(),
  };
}

function requireDocument(row: PodDocumentRow | undefined) {
  if (!row) throw new AppError('POD document was not found.', 404, 'POD_DOCUMENT_NOT_FOUND');
  return row;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}
