import 'server-only';
import { Prisma } from '@prisma/client';
import { Category } from './ledger';
import { monthRange } from './expenses';
import { readSummaries } from './planning-service';
import { sampleBatch } from './sample-data';
import { MonthSnapshot } from './expense-comparison';

export async function monthSnapshot(tx:Prisma.TransactionClient, ledgerId:string, month:string, categories:Pick<Category,'id'|'name'|'color'|'parentId'>[]):Promise<MonthSnapshot> {
  const where={userId:ledgerId,date:monthRange(month)};
  const groups=await tx.expense.groupBy({by:['categoryId','costClass'],where,_sum:{amount:true},_count:true});
  const summaries=await readSummaries(tx,{userId:ledgerId,month:where.date.gte});
  const summaryRemainder=summaries.reduce((sum,s)=>sum+s.remainder,0);
  const sampleCount=await tx.expense.count({where:{...where,OR:[{memo:{contains:sampleBatch}},{description:{startsWith:'【サンプル】'}}]}});
  const byCategory=new Map<string,{categoryId:string;name:string;color:string;amount:number}>();
  for(const group of groups){
    const child=categories.find(c=>c.id===group.categoryId),category=categories.find(c=>c.id===(child?.parentId??group.categoryId));
    const id=category?.id??group.categoryId, entry=byCategory.get(id)??{categoryId:id,name:category?.name??'未設定',color:category?.color??'#687570',amount:0};
    entry.amount+=group._sum.amount??0;byCategory.set(id,entry);
  }
  return {month,total:groups.reduce((sum,g)=>sum+(g._sum.amount??0),0)+summaryRemainder,count:groups.reduce((sum,g)=>sum+g._count,0),sampleCount,summaryRemainder,categories:[...byCategory.values()],
    costs:['fixed','variable','special','unknown'].map(costClass=>({costClass,amount:groups.filter(g=>g.costClass===costClass).reduce((sum,g)=>sum+(g._sum.amount??0),0)+(costClass==='unknown'?summaryRemainder:0)}))};
}
