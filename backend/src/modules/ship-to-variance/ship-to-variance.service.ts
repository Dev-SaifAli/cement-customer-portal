import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import { haderZoneService, pointInPolygon } from '../hader-zones/hader-zone.service.js';
import { pricingLookupService } from '../pricing/pricing-lookup.service.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { ShipToVarianceListQuery } from './ship-to-variance.validation.js';

const PAGE_SIZE = 10;

interface VarianceCandidateRow {
  shipment_id: string;
  shipment_number: string;
  shipment_status: string;
  order_id: string;
  order_number: string;
  company_name: string;
  product_id: string;
  product_code: string;
  product_name: string;
  packaging: string;
  is_white_cement: boolean;
  quantity_ton: string;
  ordered_city_id: string;
  ordered_city_name: string;
  ordered_price_per_ton: string;
  latitude: string;
  longitude: string;
  pod_updated_at: Date | string;
  shipment_updated_at: Date | string;
}

type VarianceStatus = 'NO_VARIANCE' | 'VARIANCE_DETECTED' | 'PRICING_NOT_CONFIGURED';
type DecisionStatus = 'DISMISSED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

interface DecisionRow {
  id: string;
  shipment_id: string;
  shipment_number: string;
  order_id: string;
  order_number: string;
  company_name: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity_ton: string;
  ordered_city_id: string;
  ordered_city_name: string;
  actual_city_id: string;
  actual_city_name: string;
  ordered_price_per_ton: string;
  actual_price_per_ton: string;
  difference_per_ton: string;
  extra_charge: string;
  status: DecisionStatus;
  actor_name: string;
  decided_by_name: string | null;
  rejection_reason: string | null;
  decided_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ChargeableVarianceSnapshot {
  status: VarianceStatus;
  shipment: { id: string };
  order: { id: string };
  product: { id: string };
  quantityTon: number;
  orderedCity: { id: string };
  actualCity: { id: string };
  orderedPricePerTon: number;
  actualPricePerTon: number | null;
  differencePerTon: number | null;
  extraCharge: number | null;
}

export class ShipToVarianceService {
  async list(query: ShipToVarianceListQuery) {
    const candidates = await this.candidates();
    const calculated = await this.calculate(candidates);
    const search = query.search?.toLowerCase();
    const items = calculated.filter((item) => {
      if (item.status === 'NO_VARIANCE') return false;
      if (query.status && item.status !== query.status) return false;
      if (!search) return true;
      return [
        item.shipment.number,
        item.order.number,
        item.customer.companyName,
        item.product.code,
        item.product.name,
        item.orderedCity.name,
        item.actualCity.name,
      ].some((value) => value.toLowerCase().includes(search));
    });
    const offset = (query.page - 1) * PAGE_SIZE;
    const total = items.length;
    return {
      items: items.slice(offset, offset + PAGE_SIZE),
      pagination: {
        page: query.page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    };
  }

  async detail(shipmentId: string) {
    const candidates = await this.candidates(shipmentId);
    const row = candidates[0];
    if (!row) {
      throw new AppError(
        'A delivered shipment with recorded delivery coordinates was not found.',
        404,
        'SHIP_TO_VARIANCE_NOT_FOUND',
      );
    }
    const item = (await this.calculate([row]))[0];
    if (!item) {
      throw new AppError(
        'The actual delivery city could not be resolved from configured city boundaries.',
        409,
        'ACTUAL_DELIVERY_CITY_NOT_RESOLVED',
      );
    }
    return { ...item, decision: await this.decisionForShipment(shipmentId) };
  }

  async dismiss(shipmentId: string, actor: SalesUser) {
    const variance = await this.detail(shipmentId);
    this.requireChargeableVariance(variance);
    return this.createDecision(variance, 'DISMISSED', actor);
  }

  async raiseCharge(shipmentId: string, actor: SalesUser) {
    const variance = await this.detail(shipmentId);
    this.requireChargeableVariance(variance);
    return this.createDecision(variance, 'PENDING_APPROVAL', actor);
  }

  async listPendingCharges(page: number) {
    const pageSize = 10;
    const offset = (page - 1) * pageSize;
    const [rows, count] = await Promise.all([
      pool.query<DecisionRow>(`${decisionSelect()} where decision.status='PENDING_APPROVAL' order by decision.created_at asc limit $1 offset $2`, [pageSize, offset]),
      pool.query<{ total: string }>("select count(*) total from ship_to_variance_decisions where status='PENDING_APPROVAL'"),
    ]);
    const total = Number(count.rows[0]?.total ?? 0);
    return {
      items: rows.rows.map(mapDecision),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getCharge(decisionId: string) {
    const result = await pool.query<DecisionRow>(`${decisionSelect()} where decision.id=$1`, [decisionId]);
    const row = result.rows[0];
    if (!row) throw new AppError('Ship-to variance charge was not found.', 404, 'SHIP_TO_VARIANCE_CHARGE_NOT_FOUND');
    return mapDecision(row);
  }

  async approveCharge(decisionId: string, actor: SalesUser) {
    return this.decideCharge(decisionId, 'APPROVED', null, actor);
  }

  async rejectCharge(decisionId: string, reason: string, actor: SalesUser) {
    return this.decideCharge(decisionId, 'REJECTED', reason, actor);
  }

  private requireChargeableVariance(variance: ChargeableVarianceSnapshot) {
    if (
      variance.status !== 'VARIANCE_DETECTED' ||
      variance.differencePerTon === null ||
      variance.differencePerTon <= 0 ||
      variance.extraCharge === null ||
      variance.extraCharge <= 0
    ) {
      throw new AppError('No additional charge is available for this variance.', 409, 'SHIP_TO_VARIANCE_NOT_CHARGEABLE');
    }
  }

  private async createDecision(
    variance: ChargeableVarianceSnapshot,
    status: 'DISMISSED' | 'PENDING_APPROVAL',
    actor: SalesUser,
  ) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const inserted = await client.query<{ id: string }>(
        `insert into ship_to_variance_decisions
          (shipment_id,order_id,product_id,quantity_ton,ordered_city_id,actual_city_id,
           ordered_price_per_ton,actual_price_per_ton,difference_per_ton,extra_charge,status,
           raised_or_dismissed_by_sales_user_id,decided_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         returning id`,
        [
          variance.shipment.id,
          variance.order.id,
          variance.product.id,
          variance.quantityTon,
          variance.orderedCity.id,
          variance.actualCity.id,
          variance.orderedPricePerTon,
          variance.actualPricePerTon,
          variance.differencePerTon,
          variance.extraCharge,
          status,
          actor.id,
          status === 'DISMISSED' ? new Date() : null,
        ],
      );
      const decisionId = inserted.rows[0]?.id;
      if (!decisionId) throw new AppError('Unable to record the variance decision.', 500, 'SHIP_TO_VARIANCE_DECISION_FAILED');
      await addDecisionEvent(
        client,
        decisionId,
        variance.shipment.id,
        status === 'DISMISSED' ? 'VARIANCE_DISMISSED' : 'EXTRA_CHARGE_RAISED',
        actor.id,
        { status, differencePerTon: variance.differencePerTon, extraCharge: variance.extraCharge },
      );
      await client.query('commit');
      return this.getCharge(decisionId);
    } catch (error) {
      await client.query('rollback');
      if (isUniqueViolation(error)) {
        throw new AppError('A decision has already been recorded for this shipment variance.', 409, 'SHIP_TO_VARIANCE_DECISION_EXISTS');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async decideCharge(
    decisionId: string,
    status: 'APPROVED' | 'REJECTED',
    reason: string | null,
    actor: SalesUser,
  ) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await client.query<{
        shipment_id: string;
        status: DecisionStatus;
        raised_or_dismissed_by_sales_user_id: string;
      }>(
        `select shipment_id,status,raised_or_dismissed_by_sales_user_id
         from ship_to_variance_decisions where id=$1 for update`,
        [decisionId],
      );
      const row = current.rows[0];
      if (!row) throw new AppError('Ship-to variance charge was not found.', 404, 'SHIP_TO_VARIANCE_CHARGE_NOT_FOUND');
      if (row.status !== 'PENDING_APPROVAL') {
        throw new AppError('This charge request is no longer pending approval.', 409, 'SHIP_TO_VARIANCE_CHARGE_NOT_PENDING');
      }
      if (row.raised_or_dismissed_by_sales_user_id === actor.id) {
        throw new AppError(
          'You cannot approve or reject an extra charge that you raised.',
          403,
          'SHIP_TO_VARIANCE_SELF_APPROVAL_FORBIDDEN',
        );
      }
      await client.query(
        `update ship_to_variance_decisions set status=$2,decided_by_sales_user_id=$3,
           rejection_reason=$4,decided_at=now(),updated_at=now() where id=$1`,
        [decisionId, status, actor.id, reason],
      );
      await addDecisionEvent(
        client,
        decisionId,
        row.shipment_id,
        status === 'APPROVED' ? 'EXTRA_CHARGE_APPROVED' : 'EXTRA_CHARGE_REJECTED',
        actor.id,
        { status, ...(reason ? { reason } : {}) },
      );
      await client.query('commit');
      return this.getCharge(decisionId);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async decisionForShipment(shipmentId: string) {
    const result = await pool.query<DecisionRow>(`${decisionSelect()} where decision.shipment_id=$1`, [shipmentId]);
    return result.rows[0] ? mapDecision(result.rows[0]) : null;
  }

  private async candidates(shipmentId?: string) {
    const values: unknown[] = [];
    const shipmentClause = shipmentId ? 'and s.id=$1' : '';
    if (shipmentId) values.push(shipmentId);
    const result = await pool.query<VarianceCandidateRow>(
      `select s.id shipment_id,s.shipment_number,s.status shipment_status,
        o.id order_id,o.order_number,ca.company_name,oi.product_id,oi.product_code,
        oi.product_name,oi.packaging,p.is_white_cement,s.quantity_ton,
        dr.hader_city_id ordered_city_id,ordered_city.name ordered_city_name,
        oi.approved_customer_rate_per_ton ordered_price_per_ton,
        pod.latitude,pod.longitude,pod.updated_at pod_updated_at,s.updated_at shipment_updated_at
       from shipments s
       join orders o on o.id=s.order_id
       join delivery_requests dr on dr.id=s.delivery_request_id
       join ksa_cities ordered_city on ordered_city.id=dr.hader_city_id
       join customer_accounts ca on ca.id=s.customer_account_id
       join lateral (
         select item.* from order_items item
         where item.order_id=o.id order by item.created_at limit 1
       ) oi on true
       join product_catalog p on p.id=oi.product_id
       join shipment_pods pod on pod.shipment_id=s.id
       where s.status in ('DELIVERED','CLOSED')
         and pod.latitude is not null and pod.longitude is not null
         ${shipmentClause}
       order by greatest(s.updated_at,pod.updated_at) desc,s.id`,
      values,
    );
    return result.rows;
  }

  private async calculate(rows: VarianceCandidateRow[]) {
    const cities = (await haderZoneService.listCities()).filter(
      (city) => city.isActive && city.boundary,
    );
    const calculated = await Promise.all(
      rows.map(async (row) => {
        const point = { latitude: Number(row.latitude), longitude: Number(row.longitude) };
        const actualCity = cities.find(
          (city) => city.boundary && pointInPolygon(point, city.boundary),
        );
        if (!actualCity) return null;

        const orderedPricePerTon = Number(row.ordered_price_per_ton);
        const sameCity = actualCity.id === row.ordered_city_id;
        let actualPricePerTon: number | null = orderedPricePerTon;
        if (!sameCity) {
          const [productPrice, deliveryPrice] = await Promise.all([
            pricingLookupService.getProductListPrice({
              productId: row.product_id,
              cityId: actualCity.id,
              packaging: row.packaging,
            }),
            pricingLookupService.getHaderDeliveryPrice({
              cityId: actualCity.id,
              isWhiteCement: row.is_white_cement,
            }),
          ]);
          actualPricePerTon =
            productPrice === null || deliveryPrice === null ? null : productPrice + deliveryPrice;
        }
        const differencePerTon =
          actualPricePerTon === null ? null : actualPricePerTon - orderedPricePerTon;
        const quantityTon = Number(row.quantity_ton);
        const status: VarianceStatus = sameCity
          ? 'NO_VARIANCE'
          : actualPricePerTon === null
            ? 'PRICING_NOT_CONFIGURED'
            : 'VARIANCE_DETECTED';
        return {
          id: row.shipment_id,
          shipment: {
            id: row.shipment_id,
            number: row.shipment_number,
            status: row.shipment_status,
          },
          order: { id: row.order_id, number: row.order_number },
          customer: { companyName: row.company_name },
          product: {
            id: row.product_id,
            code: row.product_code,
            name: row.product_name,
            packaging: row.packaging,
          },
          quantityTon,
          orderedCity: { id: row.ordered_city_id, name: row.ordered_city_name },
          actualCity: { id: actualCity.id, name: actualCity.name },
          orderedPricePerTon,
          actualPricePerTon,
          differencePerTon,
          extraCharge: differencePerTon === null ? null : differencePerTon * quantityTon,
          status,
          lastUpdated: new Date(
            Math.max(
              new Date(String(row.pod_updated_at)).getTime(),
              new Date(String(row.shipment_updated_at)).getTime(),
            ),
          ).toISOString(),
        };
      }),
    );
    return calculated.filter((item): item is NonNullable<typeof item> => item !== null);
  }
}

export const shipToVarianceService = new ShipToVarianceService();

function decisionSelect() {
  return `select decision.*,shipment.shipment_number,orders.order_number,accounts.company_name,
    products.product_code,products.product_name,ordered_city.name ordered_city_name,
    actual_city.name actual_city_name,actor.name actor_name,decider.name decided_by_name
   from ship_to_variance_decisions decision
   join shipments shipment on shipment.id=decision.shipment_id
   join orders on orders.id=decision.order_id
   join customer_accounts accounts on accounts.id=shipment.customer_account_id
   join product_catalog products on products.id=decision.product_id
   join ksa_cities ordered_city on ordered_city.id=decision.ordered_city_id
   join ksa_cities actual_city on actual_city.id=decision.actual_city_id
   join sales_users actor on actor.id=decision.raised_or_dismissed_by_sales_user_id
   left join sales_users decider on decider.id=decision.decided_by_sales_user_id`;
}

function mapDecision(row: DecisionRow) {
  return {
    id: row.id,
    shipment: { id: row.shipment_id, number: row.shipment_number },
    order: { id: row.order_id, number: row.order_number },
    customer: { companyName: row.company_name },
    product: { id: row.product_id, code: row.product_code, name: row.product_name },
    quantityTon: Number(row.quantity_ton),
    orderedCity: { id: row.ordered_city_id, name: row.ordered_city_name },
    actualCity: { id: row.actual_city_id, name: row.actual_city_name },
    orderedPricePerTon: Number(row.ordered_price_per_ton),
    actualPricePerTon: Number(row.actual_price_per_ton),
    differencePerTon: Number(row.difference_per_ton),
    extraCharge: Number(row.extra_charge),
    status: row.status,
    raisedOrDismissedBy: row.actor_name,
    decidedBy: row.decided_by_name,
    rejectionReason: row.rejection_reason,
    decidedAt: row.decided_at ? new Date(String(row.decided_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

async function addDecisionEvent(
  client: PoolClient,
  decisionId: string,
  shipmentId: string,
  eventType: string,
  actorId: string,
  eventData: Record<string, unknown>,
) {
  await client.query(
    `insert into ship_to_variance_events
      (decision_id,shipment_id,event_type,changed_by_sales_user_id,event_data)
     values($1,$2,$3,$4,$5::jsonb)`,
    [decisionId, shipmentId, eventType, actorId, JSON.stringify(eventData)],
  );
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
