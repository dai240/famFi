'use client';
import { useRef, useState } from 'react';
import { Upload, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Masters } from '@/lib/ledger';
import { formatYen } from '@/lib/expenses';
import { errorMessage } from '@/lib/client-api';
type Preview={hash:string;count:number;from:string;to:string;incoming:number;outgoing:number;newCount:number;existingCount:number;deletedCount:number};
export function BankImportDialog({masters,onClose,onSaved}:{masters:Masters;onClose:()=>void;onSaved:()=>void}){
  const sources=masters.paymentSources.filter(p=>!p.archived&&p.method==='bank');
  const [source,setSource]=useState(()=>sources.find(s=>masters.parties.some(p=>p.id===s.fundingPartyId&&p.kind==='shared'))?.id??'');
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<Preview|null>(null),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState<number|null>(null);
  const lock=useRef(false);
  async function upload(phase:'preview'|'apply',offset=0){
    const query=new URLSearchParams({source,phase,offset:String(offset)});if(preview)query.set('hash',preview.hash);
    const response=await fetch('/api/cash-movements/import?'+query,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file,cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.error);return data;
  }
  async function run(apply:boolean){
    if(lock.current||!file||!source)return;lock.current=true;setBusy(true);setError('');
    try{
      if(!apply){setPreview(await upload('preview'));setConfirmed(false);}
      else{let offset=0;setProgress(0);do{const result=await upload('apply',offset);offset=result.next;setProgress(result.total?Math.round(offset/result.total*100):100);if(offset>=result.total)break;}while(true);onSaved();}
    }catch(e){setError(errorMessage(e)+(apply?' 完了済みの明細は再取込で重複しません。':''));}finally{lock.current=false;setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="expense-dialog expense-entry-dialog" onInteractOutside={e=>e.preventDefault()}><DialogHeader><DialogTitle>楽天銀行CSVを取り込む</DialogTitle><DialogDescription>取込先と件数の確認</DialogDescription></DialogHeader>
    <div className="expense-form"><label htmlFor="bank-import-source">取込先の口座</label><select id="bank-import-source" value={source} disabled={busy} onChange={e=>{setSource(e.target.value);setPreview(null);setConfirmed(false);}}><option value="">口座を選択</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <label htmlFor="bank-import-file">楽天銀行の取引明細CSV</label><input id="bank-import-file" type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setPreview(null);setConfirmed(false);setProgress(null);}} />
      {preview&&<><dl className="finance-stats"><div><dt>期間</dt><dd>{preview.from} ~ {preview.to}</dd></div><div><dt>新規</dt><dd>{preview.newCount}件</dd></div><div><dt>取込済み / 削除済み</dt><dd>{preview.existingCount} / {preview.deletedCount}件</dd></div><div><dt>CSVの入金 / 出金</dt><dd>{formatYen(preview.incoming)} / {formatYen(preview.outgoing)}</dd></div></dl><label className="check-label"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} />取込先の口座と期間を確認しました</label></>}
      {progress!==null&&<p role="status">取込 {progress}%</p>}{error&&<p className="form-error" role="alert">{error}</p>}
    </div><div className="editor-save"><Button variant="outline" disabled={busy} onClick={onClose}>閉じる</Button><Button className="primary-action" disabled={busy||!file||!source||Boolean(preview&&!confirmed)} onClick={()=>run(Boolean(preview))}>{busy?<LoaderCircle className="animate-spin" />:<Upload />}{preview?'取り込む':'内容を確認'}</Button></div>
  </DialogContent></Dialog>;
}
