import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/travel_db';

const pool = mysql.createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 5,
  idleTimeout: 60000,
  queueLimit: 0,
});

export const db = drizzle(pool, {
  schema,
  mode: 'default',
});

export type Database = typeof db;
