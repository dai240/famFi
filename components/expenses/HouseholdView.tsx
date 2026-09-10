'use client';
import { useEffect, useState } from 'react';
import { LoaderCircle, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestJson, errorMessage } from '@/lib/client-api';
type Household = { name: string; members: { name: string; self: boolean; status: 'active'|'inactive'|'not_joined' }[] };
const statusLabels = { active:'参加中', inactive:'利用停止', not_joined:'ログイン未設定' };
export function HouseholdView() {
  const [data,setData] = useState<Household|null>(null), [error,setError] = useState(''), [revision,setRevision] = useState(0);
  useEffect(()=>{ const c=new AbortController(); setError(''); setData(null);
    requestJson<Household>('/api/household',{signal:c.signal}).then(d=>{if(!c.signal.aborted)setData(d);}).catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));}); return()=>c.abort();
  },[revision]);
  return <main className="expense-main"><div className="workspace-heading"><h1>家計の共有</h1><Button variant="ghost" size="icon" title="参加状況を更新" aria-label="参加状況を更新" onClick={()=>setRevision(n=>n+1)}><RefreshCw /></Button></div>
    {error?<p className="form-error" role="alert">{error}</p>:!data?<p className="workspace-message" role="status"><LoaderCircle className="animate-spin" />読み込み中</p>:<>
      <section className="household-overview"><h2>{data.name}</h2><span><ShieldCheck aria-hidden="true" />招待制・非公開</span></section>
      <section className="household-members" aria-label="家計の参加者"><h2>家計の参加者</h2><ul>{data.members.map((member,index)=><li key={index}><UserRound aria-hidden="true" /><strong>{member.name}{member.self&&<small>自分</small>}</strong><span className={'member-status '+member.status}>{statusLabels[member.status]}</span></li>)}</ul></section>
      <dl className="household-permissions"><div><dt>共有する情報</dt><dd>支出・精算・予定・共有メモ・マスタ・変更履歴</dd></div><div><dt>参加中のメンバー</dt><dd>家計の閲覧・登録・編集</dd></div><div><dt>メンバーの追加・停止</dt><dd>管理者による参加設定</dd></div><div><dt>一般公開・自由参加</dt><dd>無効</dd></div></dl>
    </>}
  </main>;
}
