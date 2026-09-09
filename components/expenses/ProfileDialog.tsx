'use client';
import { FormEvent, useRef, useState } from 'react';
import { Check, LoaderCircle, LogOut, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Masters, Party, profileFields } from '@/lib/ledger';
import { personRole } from '@/lib/household';
import { errorMessage, RequestError, requestJson } from '@/lib/client-api';

export function ProfileDialog({ person, firstTime, onSaved, onClose, onLogout }: {
  person: Party; firstTime: boolean; onSaved: (masters: Masters) => void; onClose: () => void; onLogout: () => Promise<void>;
}) {
  const [name,setName] = useState(person.name);
  const [version,setVersion] = useState(person.version);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [conflict,setConflict] = useState(false);
  const [mismatch,setMismatch] = useState(false);
  const lock = useRef(false);
  const count = Array.from(name.trim()).length;
  async function save(event: FormEvent) {
    event.preventDefault();
    const input = profileFields.safeParse({ name, version });
    if (!input.success) { setError(input.error.issues[0].message); return; }
    if (lock.current) return;
    lock.current=true;setBusy(true);setError('');setConflict(false);
    try { onSaved(await requestJson<Masters>('/api/profile',{method:'PUT',body:JSON.stringify(input.data)})); }
    catch (error) {
      if (error instanceof RequestError && error.status===401) window.location.replace('/login');
      else { setError(errorMessage(error));setConflict(error instanceof RequestError && error.status===409); }
    } finally { lock.current=false;setBusy(false); }
  }
  async function reload() {
    if(lock.current)return;lock.current=true;setBusy(true);
    try {
      const masters=await requestJson<Masters>('/api/masters');
      const current=masters.parties.find(p=>p.id===masters.selfPartyId);
      if(!current||current.id!==person.id)throw new Error('本人の紐づけを確認してください。');
      setVersion(current.version);setError('');setConflict(false);
    } catch(error){setError(errorMessage(error));} finally{lock.current=false;setBusy(false);}
  }
  async function logout() {
    if(lock.current)return;lock.current=true;setBusy(true);
    try { await onLogout(); } finally{lock.current=false;setBusy(false);}
  }
  function close() { if(!firstTime&&!busy&&(name===person.name||window.confirm('表示名の変更を破棄しますか？')))onClose(); }
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className={`expense-dialog profile-dialog ${firstTime?'profile-first':''}`} onInteractOutside={e=>e.preventDefault()} onEscapeKeyDown={e=>{if(firstTime||busy)e.preventDefault();}}>
    <DialogHeader><DialogTitle>{firstTime?'利用者を確認':'表示名の設定'}</DialogTitle><DialogDescription className="sr-only">ログイン本人の表示名</DialogDescription></DialogHeader>
    <form className="expense-form" onSubmit={save}>
      <dl className="profile-identity"><div><dt>あなた</dt><dd>{personRole(person)}</dd></div></dl>
      <div className="field-heading"><label htmlFor="profile-name">表示名</label><span className={count>10?'form-error':'muted-text'}>{count} / 10文字</span></div>
      <input id="profile-name" autoComplete="nickname" required maxLength={40} value={name} disabled={busy||mismatch} onChange={e=>setName(e.target.value)} />
      {error&&<p className="form-error" role="alert">{error}</p>}
      {conflict&&<Button type="button" variant="outline" disabled={busy} onClick={reload}><RefreshCw />最新の設定を読み込む</Button>}
      {mismatch&&<p className="form-error" role="alert">本人の紐づけの確認が必要です。別のアカウントでログインするか、招待した人に確認してください。</p>}
      {firstTime&&<Button type="button" variant="ghost" className="profile-mismatch" disabled={busy} onClick={()=>setMismatch(!mismatch)}>{mismatch?'本人の確認に戻る':'本人が違う'}</Button>}
      <div className="editor-save">
        {firstTime?<Button type="button" variant="outline" disabled={busy} onClick={logout}><LogOut />ログアウト</Button>:<Button type="button" variant="outline" disabled={busy} onClick={close}>キャンセル</Button>}
        <Button className="primary-action" disabled={busy||mismatch||count<1||count>10}>{busy?<LoaderCircle className="animate-spin" />:firstTime?<Check />:<Save />}{firstTime?'確認して始める':'保存'}</Button>
      </div>
    </form>
  </DialogContent></Dialog>;
}
