const path = require('node:path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Development logistics seed is disabled when NODE_ENV=production.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const transporters = [
  [
    'Gulf Road Logistics',
    'Gulf Road Logistics Co.',
    'Khalid Al Harbi',
    '+966551110001',
    'operations@gulfroad.test',
    '1010999001',
  ],
  [
    'Red Sea Transport',
    'Red Sea Transport Ltd.',
    'Omar Al Zahrani',
    '+966551110002',
    'dispatch@redsea.test',
    '1010999002',
  ],
  [
    'Eastern Freight Services',
    'Eastern Freight Services Co.',
    'Fahad Al Qahtani',
    '+966551110003',
    'fleet@easternfreight.test',
    '1010999003',
  ],
];
const drivers = [
  ['Ahmed Al Salem', '+966551120001', 'HDRV-DEMO-001', '2028-12-31', 'ACTIVE'],
  ['Mohammed Al Dosari', '+966551120002', 'HDRV-DEMO-002', '2029-06-30', 'ACTIVE'],
  ['Yousef Al Harbi', '+966551120003', 'HDRV-DEMO-003', '2027-09-30', 'ACTIVE'],
  ['Saleh Al Qahtani', '+966551120004', 'HDRV-DEMO-004', '2026-11-30', 'INACTIVE'],
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const actor = await client.query(
      `select id from sales_users where is_active=true
       order by (role='HADER_MANAGER') desc,(role='HADER_OPERATIONS') desc,created_at limit 1`,
    );
    const actorId = actor.rows[0]?.id;
    if (!actorId)
      throw new Error('Create an active internal Sales/Hader user before seeding logistics data.');

    const cityResult = await client.query(
      `select id,name from ksa_cities where is_active=true and name in ('Jeddah','Riyadh','Dammam') order by name`,
    );
    if (!cityResult.rows.length)
      throw new Error('No active KSA pricing cities are available. Run migrations first.');

    const transporterRows = [];
    for (const [name, company, contact, phone, email, cr] of transporters) {
      const result = await client.query(
        `insert into transporters (transporter_number,name,company_name,contact_person,phone,email,cr_number,status,created_by_sales_user_id)
         values ('TRN-'||lpad(nextval('transporter_number_seq')::text,6,'0'),$1,$2,$3,$4,$5,$6,'ACTIVE',$7)
         on conflict (lower(name),lower(company_name)) do update set contact_person=excluded.contact_person,
           phone=excluded.phone,email=excluded.email,cr_number=excluded.cr_number,status='ACTIVE',updated_at=now()
         returning id,transporter_number,company_name`,
        [name, company, contact, phone, email, cr, actorId],
      );
      transporterRows.push(result.rows[0]);
    }

    for (const [index, transporter] of transporterRows.entries()) {
      for (const [cityIndex, city] of cityResult.rows.entries()) {
        for (const [cementType, extra] of [
          ['STANDARD_CEMENT', 0],
          ['WHITE_CEMENT', 7],
        ]) {
          const cost = 14 + index * 2 + cityIndex * 1.5 + extra;
          await client.query(
            `insert into transporter_costs (transporter_id,hader_city_id,cement_type,cost_per_ton,updated_by_sales_user_id)
             values ($1,$2,$3,$4,$5)
             on conflict (transporter_id,hader_city_id,cement_type) do update set
               cost_per_ton=excluded.cost_per_ton,updated_by_sales_user_id=excluded.updated_by_sales_user_id,updated_at=now()`,
            [transporter.id, city.id, cementType, cost, actorId],
          );
        }
      }
    }

    const driverRows = [];
    for (const [name, mobile, license, expiry, status] of drivers) {
      const result = await client.query(
        `insert into hader_drivers (driver_number,name,mobile,license_number,license_expiry,status,created_by_sales_user_id)
         values ('HDR-'||lpad(nextval('hader_driver_number_seq')::text,6,'0'),$1,$2,$3,$4,$5,$6)
         on conflict (license_number) do update set name=excluded.name,mobile=excluded.mobile,
           license_expiry=excluded.license_expiry,status=excluded.status,updated_at=now()
         returning id,driver_number,name`,
        [name, mobile, license, expiry, status, actorId],
      );
      driverRows.push(result.rows[0]);
    }

    const trucks = [
      ['DEMO-JED-1001', 'Cement Bulk Tanker', 35, 2024, driverRows[0]?.id, 'ASSIGNED'],
      ['DEMO-JED-1002', 'Flatbed Trailer', 30, 2023, driverRows[1]?.id, 'ASSIGNED'],
      ['DEMO-RUH-2001', 'Cement Bulk Tanker', 38, 2025, null, 'AVAILABLE'],
      ['DEMO-DMM-3001', 'Flatbed Trailer', 28, 2021, null, 'MAINTENANCE'],
    ];
    for (const [plate, type, capacity, year, driverId, status] of trucks) {
      await client.query(
        `insert into hader_trucks (truck_number,plate_number,vehicle_type,capacity_ton,model_year,assigned_driver_id,status,created_by_sales_user_id)
         values ('HTRK-'||lpad(nextval('hader_truck_number_seq')::text,6,'0'),$1,$2,$3,$4,$5,$6,$7)
         on conflict (plate_number) do update set vehicle_type=excluded.vehicle_type,
           capacity_ton=excluded.capacity_ton,model_year=excluded.model_year,
           assigned_driver_id=excluded.assigned_driver_id,status=excluded.status,updated_at=now()`,
        [plate, type, capacity, year, driverId, status, actorId],
      );
    }

    await client.query('commit');
    console.log(
      `Seeded ${transporterRows.length} transporters, ${cityResult.rows.length * transporterRows.length * 2} costs, ${trucks.length} trucks and ${driverRows.length} drivers.`,
    );
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
