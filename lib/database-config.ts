import { readFileSync } from 'node:fs';
import path from 'node:path';

export function databaseOptions(connection: string, environment = process.env.NODE_ENV) {
  const url = new URL(connection);
  const user = decodeURIComponent(url.username);
  const local = environment !== 'production' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (user !== (local ? 'famfi_app' : 'famfi_app.fpptihhtyhehpjvmtuqt') ||
      (!local && url.hostname !== 'aws-1-ap-southeast-1.pooler.supabase.com') ||
      url.pathname !== '/postgres' || !['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('An app-scoped database connection is required');
  }
  // Parse explicitly: pg connectionString SSL query options can override certificate checks.
  return {
    host: url.hostname, port: Number(url.port || 5432), user, password: decodeURIComponent(url.password), database: 'postgres',
    ssl: local ? false as const : { ca: readFileSync(path.join(process.cwd(), 'certs/supabase-ca.crt'), 'utf8'), rejectUnauthorized: true },
    max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
  };
}
