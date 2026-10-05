import { z } from 'zod';
import { dateSchema, monthSchema, shiftMonth } from './expenses';
import type { CashRecord } from './cash-movements';

const uuid=z.string().uuid(), version=z.number().int().positive(), money=z.number().int().min(1).max(999999999);
export const bankAction=z.discriminatedUnion('action',[
  z.object({action:z.literal('post'),paymentSourceId:uuid,month:monthSchema,entries:z.array(z.object({id:uuid,version}).strict()).min(1).max(50),details:z.array(z.object({id:uuid,version}).strict()).max(50).default([]),keepSeparate:z.boolean().default(false)}).strict(),
  z.object({action:z.literal('unlink'),id:uuid,version}).strict(),
  z.object({action:z.literal('review'),month:monthSchema,complete:z.boolean(),version:z.number().int().nonnegative()}).strict(),
  z.object({action:z.literal('match'),id:uuid,version,importId:uuid,importVersion:version}).strict(),
  z.object({action:z.literal('unmatch'),id:uuid,version}).strict(),
]);
export type BankAction=z.infer<typeof bankAction>;
export type BankState={rows:CashRecord[];pendingCount:number;review:{complete:boolean;version:number};amount:number;matches:{manual:CashRecord;imported:CashRecord}[];matched:CashRecord[];details:{id:string;version:number;date:string;paymentSourceId:string|null;amount:number;name:string}[]};
export function cardExpenseMonth(debitDate:string){return monthSchema.parse(shiftMonth(debitDate.slice(0,7),-1));}
export const debtFields=z.object({date:dateSchema,name:z.string().trim().min(1).max(120),amount:money,debtorPartyId:uuid,creditorPartyId:uuid,memo:z.string().trim().max(2000).default('')}).strict();
export const debtAction=z.discriminatedUnion('action',[
  debtFields.extend({action:z.literal('save'),id:uuid,version:z.number().int().nonnegative()}),
  z.object({action:z.literal('void'),id:uuid,version}).strict(),
  z.object({action:z.literal('repay'),id:uuid,debtId:uuid,version,amount:money,date:dateSchema,paymentSourceId:uuid,memo:z.string().trim().max(500).default('')}).strict(),
  z.object({action:z.literal('cancel'),id:uuid}).strict(),
]);
export type DebtAction=z.infer<typeof debtAction>;
export type Repayment={id:string;amount:number;date:string;paymentSourceId:string;memo:string;cancelledAt:string|null};
export type DebtRecord=z.infer<typeof debtFields>&{id:string;version:number;paid:number;repayments:Repayment[]};
export type DebtResponse={rows:DebtRecord[];count:number;outstanding:number};
export type ContributionRow={id:string;date:string;partyId:string|null;amount:number;kind:'deposit'|'direct'|'refund'|'contribution';name:string};
export type ContributionResponse={rows:ContributionRow[];count:number;groups:{partyId:string|null;amount:number}[]};
