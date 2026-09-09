// Explicit table/column allowlists; backup contents can never supply SQL identifiers.
export const backupTables = [
  { key: 'categories', table: 'category_entries', fields: ['userId','id','name','color','sortOrder','parentId','archived','version'] },
  { key: 'parties', table: 'parties', fields: ['id','userId','name','kind','archived','version'] },
  { key: 'paymentSources', table: 'payment_sources', fields: ['id','userId','name','method','fundingPartyId','archived','version'] },
  { key: 'expenses', table: 'expenses', fields: ['id','userId','amount','date','categoryId','description','memo','version','createdAt','updatedAt','datePrecision','usedByPartyId','beneficiaryPartyId','paidByPartyId','paymentSourceId','reimbursementStatus','reimbursementFromPartyId','reimbursementToPartyId','reimbursementAmount'] },
  { key: 'settlements', table: 'settlements', fields: ['id','userId','expenseId','amount','date','fromPartyId','toPartyId','memo','createdAt','cancelledAt'] },
];
export const sqlColumn = key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
export function normalizeBackupRows(rows, fields) {
  return [...rows].map(row => Object.fromEntries(fields.map(key => {
    let value = row[key];
    if (value != null && ['date','createdAt','updatedAt','cancelledAt'].includes(key)) value = key === 'date' ? new Date(value).toISOString().slice(0,10) : new Date(value).toISOString();
    return [key,value];
  }))).sort((a,b) => a.id.localeCompare(b.id));
}
