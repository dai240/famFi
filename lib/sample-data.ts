// Display/entry safeguards for the explicitly requested sample batch, not an access boundary.
export const sampleBatch = 'famfi-sample-summer-2026-v1';
const sampleMemo = `${sampleBatch}: 動作確認用の架空データです。実際の請求・支払・送金ではありません。`;
export function isSampleRecord(row: { memo: string; description?: string; name?: string }) {
  return row.memo.includes(sampleBatch) || (row.description ?? '').startsWith('【サンプル】');
}
export function isProvisionalRule(row: { name: string; memo: string }) {
  return isSampleRecord(row) || row.name.startsWith('【仮】');
}
export function confirmProvisionalFields<T extends { name: string; memo: string }>(row: T): T {
  return { ...row, name: row.name.replace(/^【仮】\s*/, ''), memo: row.memo.replace(sampleMemo, '').replace(' 金額・日程は仮です。実際の請求内容へ変更して確定してください。', '').trim() };
}
