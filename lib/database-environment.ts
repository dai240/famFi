export function databaseEnvironment(env: Record<string, string | undefined> = process.env) {
  const schema = env.FAMFI_DB_SCHEMA ?? 'famfi';
  if (schema !== 'famfi' && schema !== 'famfi_preview') throw new Error('Unsupported database schema');
  if (env.VERCEL_ENV === 'preview' && (schema !== 'famfi_preview' || env.VERCEL_GIT_COMMIT_REF !== 'preview')) {
    throw new Error('Only the trusted preview branch may connect to the preview database');
  }
  if (env.VERCEL_ENV === 'production' && schema !== 'famfi') throw new Error('Production requires the production schema');
  return { schema, role: schema === 'famfi' ? 'famfi_app' : 'famfi_preview_app' };
}
