'use client';
import { FormEvent, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, LoaderCircle, LockKeyhole, Pencil, Plus, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Category, Masters, Party, PaymentSource, categoryFields, partyFields, paymentMethods, paymentSourceFields, sourceDisplayName, treatmentLabels } from '@/lib/ledger';
import { personRole } from '@/lib/household';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';
import { ReferenceSelect } from './ReferenceSelect';
import { ProfileDialog } from './ProfileDialog';

type Kind = 'categories' | 'parties' | 'payment-sources';
type Item = Category | Party | PaymentSource;
const labels = { categories: 'カテゴリ', parties: '人物・共用資金', 'payment-sources': '支払元' };
const colors = ['#16806A','#3C75B5','#8062A8','#BA7B19','#B35F79','#367D91','#AD3D4B','#727875'];
export function MasterManager({ masters, onChange, onClose, initialKind = 'categories' }: {
  masters: Masters; onChange: (masters: Masters) => void; onClose: () => void; initialKind?: Kind;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [editing, setEditing] = useState<{ item: Item | null; key: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [profileOpen,setProfileOpen] = useState(false);
  const self = masters.parties.find(p=>p.id===masters.selfPartyId);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const items = kind === 'categories' ? masters.categories : kind === 'parties' ? masters.parties : masters.paymentSources;
  async function refresh() { onChange(await requestJson<Masters>('/api/masters')); }
  async function reload() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await refresh(); } catch (error) { setError(errorMessage(error)); } finally { lock.current = false; setBusy(false); }
  }
  async function reorder(category: Category, delta: number) {
    if (lock.current) return;
    const siblings = masters.categories.filter(c => c.parentId === category.parentId);
    const index = siblings.findIndex(c => c.id === category.id); const other = index+delta;
    if (!siblings[other]) return;
    [siblings[index],siblings[other]] = [siblings[other],siblings[index]];
    lock.current = true; setBusy(true); setError('');
    try { await requestJson('/api/categories/order', { method: 'PUT', body: JSON.stringify({ entries: siblings.map(({ id, version }) => ({ id, version })) }) }); await refresh(); }
    catch (error) { setError(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy && !formBusy && (!editing || window.confirm('入力中の変更を破棄して閉じますか？'))) onClose(); }}>
    <DialogContent className="expense-dialog master-dialog" onInteractOutside={e => e.preventDefault()}>
      <DialogHeader><DialogTitle>マスタ管理</DialogTitle><DialogDescription className="sr-only">カテゴリ・人物・支払元の管理</DialogDescription></DialogHeader>
      {editing ? <MasterForm key={editing.key} kind={kind} item={editing.item} masters={masters} onBusyChange={setFormBusy} onSaved={async () => { await refresh(); setEditing(null); }} onCancel={() => setEditing(null)} /> : <>
        <Tabs value={kind} onValueChange={v => { setKind(v as Kind); setError(''); }}><TabsList className="master-tabs">{Object.entries(labels).map(([key,label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}</TabsList></Tabs>
        <div className="master-toolbar"><label className="check-label"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />使用停止も表示</label><div className="toolbar-actions"><Button size="icon" variant="ghost" title="マスタを更新" aria-label="マスタを更新" disabled={busy} onClick={reload}><RefreshCw className={busy ? 'animate-spin':''} /></Button><Button variant="outline" disabled={busy} onClick={() => setEditing({ item: null, key: crypto.randomUUID() })}><Plus />追加</Button></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <ul className="master-list">{items.filter(item => showArchived || !item.archived).map(item => {
          const cat = 'color' in item ? item : null;
          const siblings = cat ? masters.categories.filter(c => c.parentId === cat.parentId) : [];
          return <li key={item.id} className={cat?.parentId ? 'master-child' : ''}>
            <button className="master-name" disabled={busy || ('systemKey' in item && Boolean(item.systemKey) && item.id!==masters.selfPartyId)} onClick={() => { if('systemKey' in item && item.systemKey && item.id===masters.selfPartyId)setProfileOpen(true);else setEditing({ item, key: item.id }); }} aria-label={`${item.name}を編集`}>
              {cat && <i className="category-swatch" style={{ backgroundColor: cat.color }} />}
              <span><strong>{item.name}</strong><small>{item.archived ? '使用停止' : cat?.parentId ? masters.categories.find(c => c.id === cat.parentId)?.name : 'kind' in item ? item.systemKey ? `${personRole(item)}${item.id===masters.selfPartyId?'・自分':''}` : item.kind === 'person' ? '人物' : '共用資金・家族全体' : 'method' in item ? `${paymentMethods[item.method]} / ${masters.parties.find(p => p.id === item.fundingPartyId)?.name ?? '持ち主未設定'}` : '親カテゴリ'}</small></span>{'systemKey' in item && item.systemKey && item.id!==masters.selfPartyId ? <LockKeyhole aria-label="固定" /> : <Pencil aria-hidden="true" />}
            </button>
            {cat && <div className="master-order"><Button size="icon" variant="ghost" title="上へ" aria-label={`${item.name}を上へ`} disabled={busy || siblings[0]?.id === item.id} onClick={() => reorder(cat,-1)}><ArrowUp /></Button><Button size="icon" variant="ghost" title="下へ" aria-label={`${item.name}を下へ`} disabled={busy || siblings.at(-1)?.id === item.id} onClick={() => reorder(cat,1)}><ArrowDown /></Button></div>}
          </li>;
        })}</ul>
        {!items.some(item => showArchived || !item.archived) && <p className="workspace-message">登録なし</p>}
        <Button variant="outline" disabled={busy} onClick={onClose}>閉じる</Button>
      </>}
      {profileOpen&&self&&<ProfileDialog person={self} firstTime={false} onSaved={next=>{onChange(next);setProfileOpen(false);}} onClose={()=>setProfileOpen(false)} onLogout={async()=>{await requestJson('/api/auth/logout',{method:'POST'});window.location.replace('/login');}} />}
    </DialogContent>
  </Dialog>;
}

function MasterForm({ kind, item, masters, onSaved, onCancel, onBusyChange }: { kind: Kind; item: Item | null; masters: Masters; onSaved: () => Promise<void>; onCancel: () => void; onBusyChange: (busy: boolean) => void }) {
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [name, setName] = useState(item && 'method' in item ? item.ownerLabel ?? item.storedName ?? item.name : item?.name ?? '');
  const [linkOwner,setLinkOwner] = useState(item && 'method' in item ? Boolean(item.ownerLabel) : true);
  const [color, setColor] = useState(item && 'color' in item ? item.color : colors[0]);
  const [parentId, setParent] = useState(item && 'parentId' in item ? item.parentId : null);
  const [partyKind, setPartyKind] = useState<'person'|'shared'>(item && 'kind' in item ? item.kind : 'person');
  const [method, setMethod] = useState<PaymentSource['method']>(item && 'method' in item ? item.method : 'card');
  const [fundingPartyId, setFunding] = useState(item && 'fundingPartyId' in item ? item.fundingPartyId : null);
  const [archived, setArchived] = useState(item?.archived ?? false);
  const [defaultTreatment,setDefaultTreatment] = useState<PaymentSource['defaultTreatment']>(item && 'defaultTreatment' in item ? item.defaultTreatment : 'review');
  const [isDefault,setIsDefault] = useState(item && 'isDefault' in item ? item.isDefault : false);
  const sharedFunding = masters.parties.find(p=>p.id===fundingPartyId)?.kind==='shared';
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const category = { name, color, parentId, archived, sortOrder: item && 'sortOrder' in item ? item.sortOrder : Math.min(100000, Math.max(0,...masters.categories.map(c => c.sortOrder))+10) };
  const ownerLabel = !sharedFunding && linkOwner ? name.trim() || null : null;
  const body = kind === 'categories' ? category : kind === 'parties' ? { name, kind: partyKind, archived } : { name, ownerLabel, method, fundingPartyId, archived, defaultTreatment, isDefault };
  const baseline = useRef(JSON.stringify(body));
  function cancel() { if (!busy && (JSON.stringify(body) === baseline.current || window.confirm('入力中の変更を破棄しますか？'))) onCancel(); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (lock.current) return; setError('');
    const schema = kind === 'categories' ? categoryFields : kind === 'parties' ? partyFields : paymentSourceFields;
    if (!schema.safeParse(body).success) { setError('名称・選択内容を確認してください。'); return; }
    lock.current = true; setBusy(true); onBusyChange(true);
    try {
      const base = kind === 'categories' ? '/api/categories' : `/api/masters/${kind}`;
      await requestJson(item ? `${base}/${id}` : base, { method: item ? 'PUT' : 'POST', body: JSON.stringify({ ...body, ...(item ? { version: item.version } : { id }) }) });
      await onSaved();
    } catch (error) { if (error instanceof RequestError && error.status === 401) window.location.replace('/login'); else setError(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  return <form className="expense-form" onSubmit={save}>
    <div className="master-form-heading"><Button type="button" size="icon" variant="ghost" aria-label="管理一覧へ戻る" title="戻る" disabled={busy} onClick={cancel}><ArrowLeft /></Button><h3>{labels[kind]}を{item ? '編集' : '追加'}</h3></div>
    {kind !== 'payment-sources' && <><label htmlFor="master-name">名称</label><input id="master-name" autoFocus required maxLength={40} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></>}
    {kind === 'categories' && <>
      <label htmlFor="master-parent">親カテゴリ</label><ReferenceSelect id="master-parent" label="親カテゴリ" value={parentId} emptyLabel="なし（親カテゴリとして登録）" disabled={busy || masters.categories.some(c => c.parentId === id)} options={masters.categories.filter(c => !c.parentId && c.id !== id && (!c.archived || c.id === parentId))} onChange={setParent} />
      <label htmlFor="master-color">色</label><div className="color-controls"><input id="master-color" aria-label="カテゴリの色" type="color" value={color} disabled={busy} onChange={e => setColor(e.target.value)} /><div className="color-palette">{colors.map(value => <button key={value} type="button" className="color-button" title={value} aria-label={`色 ${value}`} aria-pressed={color.toLowerCase() === value.toLowerCase()} disabled={busy} style={{ backgroundColor: value }} onClick={() => setColor(value)} />)}</div></div>
    </>}
    {kind === 'parties' && <fieldset disabled={busy || Boolean(item)}><legend>種類</legend><div className="date-mode">{(['person','shared'] as const).map(value => <label key={value}><input type="radio" name="party-kind" checked={partyKind===value} onChange={() => setPartyKind(value)} /><span>{value === 'person' ? '人物' : '共用資金・家族全体'}</span></label>)}</div></fieldset>}
    {kind === 'payment-sources' && <>
      <label htmlFor="master-funding">資金の持ち主</label><ReferenceSelect id="master-funding" label="資金の持ち主" value={fundingPartyId} disabled={busy} options={masters.parties.filter(p => !p.archived || p.id === fundingPartyId)} allowEmpty={false} emptyLabel="選択してください" onChange={id=>{setFunding(id);setDefaultTreatment(masters.parties.find(p=>p.id===id)?.kind==='shared'?'shared':'advance');}} />
      <label htmlFor="master-method">支払方法</label><ReferenceSelect id="master-method" label="支払方法" value={method} disabled={busy} options={Object.entries(paymentMethods).map(([id,name]) => ({ id,name }))} emptyLabel="選択してください" onChange={v => { if (v) setMethod(v as PaymentSource['method']); }} />
      <label htmlFor="master-name">{!sharedFunding&&linkOwner?'識別名':'名称'}</label><input id="master-name" required maxLength={linkOwner&&!sharedFunding?40:60} value={name} disabled={busy} onChange={e=>setName(e.target.value)} />
      {fundingPartyId&&!sharedFunding&&<label className="check-label"><input type="checkbox" checked={linkOwner} disabled={busy} onChange={e=>setLinkOwner(e.target.checked)} />持ち主の名前を付ける</label>}
      {name&&fundingPartyId&&<output className="source-name-preview" aria-label="支払元の表示名">{sourceDisplayName({name,ownerLabel,fundingPartyId},masters.parties)}</output>}
      <label htmlFor="master-treatment">初期の支払いの扱い</label><ReferenceSelect id="master-treatment" label="初期の支払いの扱い" value={defaultTreatment} disabled={busy} allowEmpty={false} options={(sharedFunding?['shared','review']:['advance','direct','review']).map(id=>({id,name:treatmentLabels[id as keyof typeof treatmentLabels]}))} onChange={v=>{if(v)setDefaultTreatment(v as PaymentSource['defaultTreatment']);}} />
      <label className="check-label"><input type="checkbox" checked={isDefault} disabled={busy || archived || Boolean(item && 'isDefault' in item && item.isDefault)} onChange={e=>setIsDefault(e.target.checked)} />新規支出の初期値</label>
    </>}
    {item && <label className="check-label"><input type="checkbox" checked={archived} disabled={busy || (kind==='payment-sources' && isDefault)} onChange={e => setArchived(e.target.checked)} />使用停止</label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="editor-save"><Button type="button" variant="outline" disabled={busy} onClick={cancel}>キャンセル</Button><Button className="primary-action" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Save />}保存</Button></div>
  </form>;
}
