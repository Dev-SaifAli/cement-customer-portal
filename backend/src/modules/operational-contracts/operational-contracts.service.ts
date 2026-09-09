import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import { applicationSettingsService } from '../application-settings/application-settings.service.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { ListOperationalContractsQuery } from './operational-contracts.validation.js';

const pageSize = 10;

interface ContractRow {
  id: string;
  reference: string | null;
  customer_account_id: string;
  customer_name: string;
  product_id: string;
  product_code: string;
  product_name: string;
  packaging: string;
  fulfilment: 'DELIVERY' | 'PICKUP';
  status: string;
  start_date: string | Date;
  end_date: string | Date;
  total_quantity_tons: string | null;
  remaining_quantity_tons: string | null;
  quantity: string;
  delivery_location_id: string | null;
  pickup_location_id: string | null;
  pickup_location_city: string | null;
  delivery_city: string | null;
  ship_to_city: string | null;
  order_count: string;
  customer_rate: string;
  pallet_required: boolean;
  pallet_type: string | null;
}

export class OperationalContractsService {
  async access(user: SalesUser) {
    const scope = getScope(user);
    return {
      enabled: await applicationSettingsService.isContractOrderCreationAllowed(scope.setting),
      fulfilment: scope.fulfilment,
    };
  }

  async list(user: SalesUser, query: ListOperationalContractsQuery) {
    const scope = await requireEnabledScope(user);
    const values: unknown[] = [scope.fulfilment];
    const conditions = [
      `contracts.status = 'ACTIVE'`,
      `contracts.fulfilment = $1`,
      `coalesce(contracts.remaining_quantity_tons, contracts.total_quantity_tons, contracts.quantity) > 0`,
    ];
    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      conditions.push(`(lower(coalesce(contracts.reference, '')) like $${values.length}
        or lower(accounts.company_name) like $${values.length}
        or lower(products.product_code) like $${values.length}
        or lower(products.product_name) like $${values.length})`);
    }
    if (query.productId) {
      values.push(query.productId);
      conditions.push(`contracts.product_id = $${values.length}`);
    }
    if (query.startDate) {
      values.push(query.startDate);
      conditions.push(`contracts.start_date = $${values.length}`);
    }
    const where = conditions.join(' and ');
    const totalResult = await pool.query<{ total: string }>(
      `select count(*)::text as total from contracts
       inner join customer_accounts accounts on accounts.id = contracts.customer_account_id
       inner join product_catalog products on products.id = contracts.product_id where ${where}`,
      values,
    );
    const offset = (query.page - 1) * pageSize;
    const listValues = [...values, pageSize, offset];
    const result = await pool.query<ContractRow>(
      `${selectSql} where ${where} order by contracts.updated_at desc
       limit $${listValues.length - 1} offset $${listValues.length}`,
      listValues,
    );
    const total = Number(totalResult.rows[0]?.total ?? 0);
    return {
      items: result.rows.map(mapContract),
      pagination: { page: query.page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async getById(user: SalesUser, id: string) {
    const scope = await requireEnabledScope(user);
    const result = await pool.query<ContractRow>(
      `${selectSql} where contracts.id = $1 and contracts.status = 'ACTIVE'
       and contracts.fulfilment = $2
       and coalesce(contracts.remaining_quantity_tons, contracts.total_quantity_tons, contracts.quantity) > 0`,
      [id, scope.fulfilment],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('Eligible contract was not found.', 404, 'OPERATIONAL_CONTRACT_NOT_FOUND');
    const fleet = scope.fulfilment === 'PICKUP' ? await pickupFleet(row.customer_account_id) : null;
    return { ...mapContract(row), pickupFleet: fleet };
  }

  async filterOptions(user: SalesUser) {
    const scope = await requireEnabledScope(user);
    const result = await pool.query<{ id: string; product_code: string; product_name: string }>(
      `select distinct products.id, products.product_code, products.product_name
       from contracts inner join product_catalog products on products.id = contracts.product_id
       where contracts.status = 'ACTIVE' and contracts.fulfilment = $1
       and coalesce(contracts.remaining_quantity_tons, contracts.total_quantity_tons, contracts.quantity) > 0
       order by products.product_name`,
      [scope.fulfilment],
    );
    return { products: result.rows.map((row) => ({ id: row.id, code: row.product_code, name: row.product_name })) };
  }
}

const selectSql = `select contracts.id, contracts.reference, contracts.customer_account_id,
  accounts.company_name as customer_name, contracts.product_id, products.product_code,
  products.product_name, contracts.packaging, contracts.fulfilment, contracts.status,
  contracts.start_date, contracts.end_date, contracts.total_quantity_tons,
  contracts.remaining_quantity_tons, contracts.quantity, contracts.delivery_location_id,
  contracts.pickup_location_id, contracts.delivery_city,
  pickup_cities.name as pickup_location_city,
  ship_to_location.city as ship_to_city,
  contract_orders.order_count,
  contracts.pallet_required, contracts.pallet_type,
  (contracts.product_price + coalesce(contracts.delivery_price, 0))::text as customer_rate
  from contracts
  inner join customer_accounts accounts on accounts.id = contracts.customer_account_id
  inner join registration_drafts on registration_drafts.id = accounts.registration_id
  inner join product_catalog products on products.id = contracts.product_id
  left join pickup_locations on pickup_locations.id::text = contracts.pickup_location_id
  left join ksa_cities pickup_cities on pickup_cities.id = pickup_locations.city_id
  left join lateral (
    select location->>'city' as city
    from jsonb_array_elements(coalesce(registration_drafts.delivery_locations, '[]'::jsonb)) location
    where location->>'id' = contracts.delivery_location_id
    limit 1
  ) ship_to_location on true
  left join lateral (
    select count(*)::text as order_count from orders where orders.contract_id = contracts.id
  ) contract_orders on true`;

function getScope(user: SalesUser) {
  if (user.role === 'HADER_MANAGER' || user.role === 'HADER_OPERATIONS') {
    return { setting: 'hader' as const, fulfilment: 'DELIVERY' as const };
  }
  if (user.role === 'DISPATCH_USER') {
    return { setting: 'dispatch' as const, fulfilment: 'PICKUP' as const };
  }
  throw new AppError('Operational contract access is forbidden.', 403, 'OPERATIONAL_CONTRACT_FORBIDDEN');
}

async function requireEnabledScope(user: SalesUser) {
  const scope = getScope(user);
  if (!(await applicationSettingsService.isContractOrderCreationAllowed(scope.setting))) {
    throw new AppError('Contract order creation is disabled by the administrator.', 403, 'CONTRACT_ORDER_CREATION_DISABLED');
  }
  return scope;
}

async function pickupFleet(customerAccountId: string) {
  const [trucks, drivers] = await Promise.all([
    pool.query<{ id: string; plate_number: string; vehicle_type: string; capacity_ton: string }>(
      `select id, plate_number, vehicle_type, capacity_ton from customer_trucks
       where customer_account_id = $1 and status = 'ACTIVE' order by plate_number`, [customerAccountId]),
    pool.query<{ id: string; name: string; mobile: string }>(
      `select id, name, mobile from customer_drivers
       where customer_account_id = $1 and status = 'ACTIVE' order by name`, [customerAccountId]),
  ]);
  return {
    trucks: trucks.rows.map((row) => ({ id: row.id, plateNumber: row.plate_number, vehicleType: row.vehicle_type, capacityTon: Number(row.capacity_ton) })),
    drivers: drivers.rows.map((row) => ({ id: row.id, name: row.name, mobile: row.mobile })),
  };
}

function mapContract(row: ContractRow) {
  return {
    id: row.id, reference: row.reference, customer: { id: row.customer_account_id, name: row.customer_name },
    product: { id: row.product_id, code: row.product_code, name: row.product_name, packaging: row.packaging },
    fulfilment: row.fulfilment, status: row.status,
    totalQuantityTons: Number(row.total_quantity_tons ?? row.quantity),
    remainingQuantityTons: Number(row.remaining_quantity_tons ?? row.total_quantity_tons ?? row.quantity),
    startDate: new Date(String(row.start_date)).toISOString(), endDate: new Date(String(row.end_date)).toISOString(),
    deliveryLocationId: row.delivery_location_id, pickupLocationId: row.pickup_location_id,
    haderCity: row.fulfilment === 'DELIVERY' ? row.delivery_city : null,
    shipToCity: row.fulfilment === 'PICKUP'
      ? row.pickup_location_city ?? (row.pickup_location_id === 'ALSAFWA_PLANT_MAIN' ? 'Jeddah' : null)
      : row.ship_to_city,
    orderCount: Number(row.order_count),
    customerRatePerTon: Number(row.customer_rate),
    palletRequired: row.pallet_required, palletType: row.pallet_type,
  };
}

export const operationalContractsService = new OperationalContractsService();
