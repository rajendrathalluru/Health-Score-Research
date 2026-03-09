import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'db.xfldllkszcfeugfjnbvq.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Jean_vitalit',
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('✓ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err.message);
  console.error('Full error:', err);
});

export default pool;
