'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, LoaderCircle, Mail, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage, requestJson } from '@/lib/client-api';

export function LoginForm({ ready }: { ready: boolean }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timeout = setTimeout(() => setCooldown(n => n - 1), 1000);
    return () => clearTimeout(timeout);
  }, [cooldown]);
  async function submit(event?: FormEvent, resend = false) {
    event?.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (!sent || resend) {
        await requestJson('/api/auth/request', { method: 'POST', body: JSON.stringify({ email }) });
        setSent(true); setCooldown(60);
      } else {
        await requestJson('/api/auth/verify', { method: 'POST', body: JSON.stringify({ email, token }) });
        window.location.replace('/expenses');
      }
    } catch (error) { setError(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="expense-app login-page">
    <div className="login-content">
      <Link href="/" className="famfi-brand"><ReceiptText aria-hidden="true" />famFi</Link>
      <h1>ログイン</h1>
      <form onSubmit={submit} className="expense-form">
        <label htmlFor="email">メールアドレス</label>
        <input id="email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={!ready || sent || busy} onChange={e => setEmail(e.target.value)} />
        {sent && <>
          <p className="muted-text" role="status">利用可能なアドレスに確認コードを送信しました。</p>
          <label htmlFor="token">確認コード</label>
          <input id="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required autoFocus value={token} onChange={e => setToken(e.target.value.replace(/\D/g, ''))} />
        </>}
        {error && <p role="alert" className="form-error">{error}</p>}
        {!ready && <p className="muted-text" role="status">利用アカウントを準備中です。</p>}
        <Button type="submit" disabled={!ready || busy} className="primary-action login-submit">{busy ? <LoaderCircle className="animate-spin" /> : sent ? <ArrowRight /> : <Mail />}{sent ? 'ログイン' : '確認コードを送信'}</Button>
      </form>
      {sent && <div className="login-secondary">
        <Button variant="ghost" disabled={busy || cooldown > 0} onClick={() => submit(undefined, true)}>{cooldown > 0 ? `再送まで ${cooldown}秒` : 'コードを再送'}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => { setSent(false); setToken(''); setError(''); }}>アドレスを変更</Button>
      </div>}
    </div>
  </main>;
}
