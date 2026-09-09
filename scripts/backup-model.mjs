// Explicit table/column allowlists; backup contents can never supply SQL identifiers.
export const backupTables = [
  { key: 'categories', table: 'category_entries', fields: ['userId','id','name','color','sortOrder','parentId','archived','version'] },
  { key: 'parties', table: 'parties', fields: ['id','userId','name','kind','archived','version'] },
  { key: 'paymentSources', table: 'payment_sources', fields: ['id','userId','name','method','fundingPartyId','archived','version'] },
  { key: 'expenses', table: 'expenses', fields: ['id','userId','amount','date','categoryId','description','memo','version','createdAt','updatedAt','datePrecision','usedByPartyId','beneficiaryPartyId','paidByPartyId','paymentSourceId','reimbursementStatus','reimbursementFromPartyId','reimbursementToPartyId','reimbursementAmount'] },
  { key: 'settlements', table: 'settlements', fields: ['id','userId','expenseId','amount','date','fromPartyId','toPartyId','memo','createdAt','cancelledAt'] },
];
export const sqlColumn = key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
export const householdBackupTables = [
  ...backupTables.map(dataset=>({...dataset,fields:[...dataset.fields,...(dataset.key==='parties'?['systemKey']:dataset.key==='paymentSources'?['defaultTreatment','isDefault']:dataset.key==='expenses'?['paymentTreatment','beneficiaryKind','beneficiaryText','usedByText','recordedByPartyId','updatedByPartyId']:[])]})),
  {key:'recurringRules',table:'recurring_rules',fields:['id','userId','name','amountMode','amount','frequency','startMonth','endMonth','dueDay','categoryId','paymentSourceId','paymentTreatment','usedByPartyId','usedByText','beneficiaryKind','beneficiaryPartyId','beneficiaryText','memo','archived','version','createdAt','updatedAt']},
  {key:'recurringOccurrences',table:'recurring_occurrences',fields:['id','userId','ruleId','period','state','expenseId','version','updatedAt']},
  {key:'auditEvents',table:'audit_events',fields:['id','userId','entityType','entityId','action','actorPartyId','beforeData','afterData','createdAt']},
];
export async function captureHouseholdBackup(query,actorId){
  const member=(await query('select ledger_id,party_id from famfi.household_members where user_id=$1',[actorId])).rows[0];
  if(!member)throw new Error('An active household member is required');
  const household=(await query('select id,name from famfi.households')).rows[0];
  const payload={format:'famfi-expenses/v4',exportedAt:new Date().toISOString(),ownerId:member.ledger_id,exportedByPartyId:member.party_id,household};
  for(const dataset of householdBackupTables)payload[dataset.key]=(await query(`select ${dataset.fields.map(key=>`${sqlColumn(key)} as "${key}"`).join(',')} from famfi.${dataset.table} order by id`)).rows;
  return payload;
}
export function normalizeBackupRows(rows, fields) {
  return [...rows].map(row => Object.fromEntries(fields.map(key => {
    let value = row[key];
    if (value != null && ['date','createdAt','updatedAt','cancelledAt','startMonth','endMonth','period'].includes(key)) value = ['date','startMonth','endMonth','period'].includes(key) ? new Date(value).toISOString().slice(0,10) : new Date(value).toISOString();
    return [key,value];
  }))).sort((a,b) => a.id.localeCompare(b.id));
}
