'use client';
import { Masters } from '@/lib/ledger';
export function SettlementFunding({masters,from,to,kind,source,onKind,onSource,disabled=false}:{masters:Masters;from:string|null;to:string|null;kind:'refund'|'contribution';source:string;onKind:(kind:'refund'|'contribution')=>void;onSource:(id:string)=>void;disabled?:boolean}){
  const household=masters.parties.some(p=>p.id===from&&p.kind==='shared');
  return <><label htmlFor="settlement-kind">今回の扱い</label><select id="settlement-kind" value={kind} disabled={disabled} onChange={e=>onKind(e.target.value as 'refund'|'contribution')}><option value="refund">実際に返金した</option>{household&&<option value="contribution">返金せず、元の支払者の家計負担にする</option>}</select>
    {kind==='refund'&&<><label htmlFor="settlement-source">実際の返金元</label><select id="settlement-source" required value={source} disabled={disabled} onChange={e=>onSource(e.target.value)}><option value="">選択してください</option>{masters.paymentSources.filter(s=>!s.archived&&s.fundingPartyId&&s.fundingPartyId!==to&&(household||s.fundingPartyId===from)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></>}
  </>;
}
