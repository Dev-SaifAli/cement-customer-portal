require('dotenv').config({ path: '../.env' });

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const customerEmail = process.env.CUSTOMER_EMAIL?.trim().toLowerCase();
  const resetPassword = process.env.CUSTOMER_RESET_PASSWORD;
  if (!customerEmail || !resetPassword) {
    throw new Error('CUSTOMER_EMAIL and CUSTOMER_RESET_PASSWORD are required.');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  const passwordHash = await bcrypt.hash(resetPassword, 12);

  const result = await client.query(
    `UPDATE customer_users
     SET password_hash = $1
     WHERE email = $2
     RETURNING id, email, role`,
    [passwordHash, customerEmail],
  );

  console.log(result.rows);

  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
