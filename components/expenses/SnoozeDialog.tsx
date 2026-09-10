import {useState} from 'react';
import {Clock3} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {todayInJapan} from '@/lib/expenses';
import {errorMessage} from '@/lib/client-api';
export function SnoozeDialog({name,onClose,onSave}:{name:string;onClose:()=>void;onSave:(until:string)=>Promise<void>}){
  const [date,setDate]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="expense-dialog"><DialogHeader><DialogTitle>確認を後日にする</DialogTitle><DialogDescription>{name}</DialogDescription></DialogHeader><form className="expense-form" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await onSave(date);onClose();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}><label htmlFor="snooze-date">次に確認する日</label><input id="snooze-date" type="date" required min={todayInJapan()} max="2099-12-31" value={date} onChange={e=>setDate(e.target.value)} disabled={busy} />{error&&<p className="form-error" role="alert">{error}</p>}<div className="editor-save"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>キャンセル</Button><Button disabled={busy||!date}><Clock3 />変更</Button></div></form></DialogContent></Dialog>;
}
