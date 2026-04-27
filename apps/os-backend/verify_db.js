const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_team_lead'`);
  if (res.rows.length === 0) {
    console.log("Adding is_team_lead column to users table...");
    await client.query(`ALTER TABLE users ADD COLUMN is_team_lead boolean NOT NULL DEFAULT false;`);
    console.log("Column added successfully!");
  } else {
    console.log("Column is_team_lead already exists.");
  }
  await client.end();
}
run().catch(console.error);
