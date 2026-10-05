import 'server-only';
import { Prisma } from '@prisma/client';
import { dbSchema } from './database-schema';

// Advances become contributions only when waived or actually funded by a person.
export function fundingQuery(ledgerId: string) {
  return Prisma.sql`funding as (
    select c.id,c.date,case when c.kind='contribution' then c.party_id else null end as "partyId",
      c.amount,'deposit' as kind,c.description as name,c.payment_source_id as "sourceId",null::uuid as "expenseId"
    from ${dbSchema}.cash_movements c join ${dbSchema}.payment_sources p on p.user_id=c.user_id and p.id=c.payment_source_id
    join ${dbSchema}.parties f on f.user_id=p.user_id and f.id=p.funding_party_id
    where c.user_id=${ledgerId}::uuid and not c.voided and c.matched_import_id is null and c.amount>0
      and c.kind in ('contribution','unknown') and f.kind='shared'
    union all
    select e.id,e.ledger_date,e.paid_by_party_id,
      case when e.payment_treatment='direct' then e.amount else e.amount-e.reimbursement_amount end,
      'direct',e.description,e.payment_source_id,e.id
    from ${dbSchema}.expenses e join ${dbSchema}.parties p on p.user_id=e.user_id and p.id=e.paid_by_party_id
    where e.user_id=${ledgerId}::uuid and p.kind='person' and (e.payment_treatment='direct' or
      (e.reimbursement_status='required' and e.amount>e.reimbursement_amount and exists(
        select 1 from ${dbSchema}.parties f where f.user_id=e.user_id and f.id=e.reimbursement_from_party_id and f.kind='shared')))
    union all
    select r.id,r.date,case when r.kind='contribution' then r.to_party_id else p.funding_party_id end,
      r.amount,r.kind,e.description,r.payment_source_id,e.id
    from ${dbSchema}.settlements r join ${dbSchema}.expenses e on e.user_id=r.user_id and e.id=r.expense_id
    left join ${dbSchema}.payment_sources p on p.user_id=r.user_id and p.id=r.payment_source_id
    where r.user_id=${ledgerId}::uuid and r.cancelled_at is null
      and exists(select 1 from ${dbSchema}.parties f where f.user_id=r.user_id and f.id=r.from_party_id and f.kind='shared')
      and (r.kind='contribution' or exists(
        select 1 from ${dbSchema}.parties f where f.user_id=p.user_id and f.id=p.funding_party_id and f.kind='person'))
  )`;
}
