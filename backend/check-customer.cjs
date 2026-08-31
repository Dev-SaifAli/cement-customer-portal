require('dotenv').config({ path: '../.env' });

const { Client } = require('pg');

async function main() {
  const customerEmail = process.env.CUSTOMER_EMAIL?.trim().toLowerCase();
  if (!customerEmail) {
    throw new Error('CUSTOMER_EMAIL is required.');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  const result = await client.query(
    `SELECT id, customer_account_id, name, email, phone, role, is_active, created_at, updated_at
     FROM customer_users
     WHERE email = $1`,
    [customerEmail],
  );

  console.log(result.rows);

  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
