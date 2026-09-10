// Explicit table/column allowlists; backup contents can never supply SQL identifiers.
export const backupTables = [
  { key: 'categories', table: 'category_entries', fields: ['userId','id','name','color','sortOrder','parentId','archived','version'] },
  { key: 'parties', table: 'parties', fields: ['id','userId','name','kind','archived','version'] },
  { key: 'paymentSources', table: 'payment_sources', fields: ['id','userId','name','method','fundingPartyId','archived','version'] },
  { key: 'expenses', table: 'expenses', fields: ['id','userId','amount','date','categoryId','description','memo','version','createdAt','updatedAt','datePrecision','usedByPartyId','beneficiaryPartyId','paidByPartyId','paymentSourceId','reimbursementStatus','reimbursementFromPartyId','reimbursementToPartyId','reimbursementAmount'] },
  { key: 'settlements', table: 'settlements', fields: ['id','userId','expenseId','amount','date','fromPartyId','toPartyId','memo','createdAt','cancelledAt'] },
];
export const sqlColumn = key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const calendarDates = new Set(['date','startMonth','endMonth','period','month','reviewAfter','snoozedUntil']);
// PostgreSQL DATE is not an instant. pg's local-midnight Date parsing loses a day in JST.
export const backupSelectColumns = fields => fields.map(key => `${sqlColumn(key)}${calendarDates.has(key)?'::text':''} as "${key}"`).join(',');
export const householdBackupTables = [
  ...backupTables.map(dataset=>({...dataset,fields:[...dataset.fields,...(dataset.key==='parties'?['systemKey']:dataset.key==='paymentSources'?['defaultTreatment','isDefault']:dataset.key==='expenses'?['paymentTreatment','beneficiaryKind','beneficiaryText','usedByText','recordedByPartyId','updatedByPartyId']:[])]})),
  {key:'recurringRules',table:'recurring_rules',fields:['id','userId','name','amountMode','amount','frequency','startMonth','endMonth','dueDay','categoryId','paymentSourceId','paymentTreatment','usedByPartyId','usedByText','beneficiaryKind','beneficiaryPartyId','beneficiaryText','memo','archived','version','createdAt','updatedAt']},
  {key:'recurringOccurrences',table:'recurring_occurrences',fields:['id','userId','ruleId','period','state','expenseId','version','updatedAt']},
  {key:'auditEvents',table:'audit_events',fields:['id','userId','entityType','entityId','action','actorPartyId','beforeData','afterData','createdAt']},
];
export const profileBackupTables = householdBackupTables.map(dataset => ({...dataset, fields:[...dataset.fields,
  ...(dataset.key==='parties'?['nickname','profileConfirmed']:dataset.key==='paymentSources'?['ownerLabel']:[])]}));
export const planningBackupTables=profileBackupTables.flatMap(dataset=>[
  ...(dataset.key==='expenses'?[{key:'expenseSummaries',table:'expense_summaries',fields:['id','userId','paymentSourceId','month','amount','name','memo','complete','version','createdAt','updatedAt']}]:[]),
  {...dataset,fields:[...dataset.fields,...(dataset.key==='categories'?['costClass']:dataset.key==='expenses'?['costClass','summaryId']:dataset.key==='recurringRules'?['costClass','reviewDay','reviewMonthOffset']:dataset.key==='recurringOccurrences'?['snoozedUntil']:[])]},
  ...(dataset.key==='recurringOccurrences'?[{key:'plannedExpenses',table:'planned_expenses',fields:['id','userId','name','date','datePrecision','amount','categoryId','paymentSourceId','memo','reviewAfter','snoozedUntil','state','expenseId','version','createdAt','updatedAt']}]:[]),
]);
export const notesBackupTables=[...planningBackupTables,{key:'householdNotes',table:'household_notes',fields:['id','userId','name','memo','kind','date','datePrecision','completed','version','createdAt','updatedAt']}];
export async function captureHouseholdBackup(query,actorId,format,schema=process.env.FAMFI_DB_SCHEMA??'famfi'){
  if(!['famfi','famfi_preview'].includes(schema))throw new Error('Unsupported backup schema');
  if(!format){const features=(await query('select to_regclass($1) is not null as planning,to_regclass($2) is not null as notes',[`${schema}.expense_summaries`,`${schema}.household_notes`])).rows[0];format=features.notes?'famfi-expenses/v7':features.planning?'famfi-expenses/v6':'famfi-expenses/v5';}
  const member=(await query(`select ledger_id,party_id from ${schema}.household_members where user_id=$1`,[actorId])).rows[0];
  if(!member)throw new Error('An active household member is required');
  const household=(await query(`select id,name from ${schema}.households`)).rows[0];
  const payload={format,exportedAt:new Date().toISOString(),ownerId:member.ledger_id,exportedByPartyId:member.party_id,household,...(['famfi-expenses/v6','famfi-expenses/v7'].includes(format)?{environment:schema}: {})};
  for(const dataset of format==='famfi-expenses/v7'?notesBackupTables:format==='famfi-expenses/v6'?planningBackupTables:format==='famfi-expenses/v5'?profileBackupTables:householdBackupTables)payload[dataset.key]=(await query(`select ${backupSelectColumns(dataset.fields)} from ${schema}.${dataset.table} order by id`)).rows;
  return payload;
}
export function normalizeBackupRows(rows, fields) {
  return [...rows].map(row => Object.fromEntries(fields.map(key => {
    let value = row[key];
    if (value != null && (calendarDates.has(key)||['createdAt','updatedAt','cancelledAt'].includes(key))) value = calendarDates.has(key) ? new Date(value).toISOString().slice(0,10) : new Date(value).toISOString();
    return [key,value];
  }))).sort((a,b) => a.id.localeCompare(b.id));
}
