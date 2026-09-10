'use client';
import { useRef, useState } from 'react';
import { ArrowLeftRight, CalendarClock, History, LogOut, Menu, Plus, ReceiptText, Settings2, StickyNote, UsersRound, UserRound } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export function BottomNavigation({ view, attention, ready, busy, onNavigate, onAdd, onMasters, onProfile, onLogout }: {
  view: string; attention: number | null; ready: boolean; busy: boolean;
  onNavigate: (view: string) => void; onAdd: () => void; onMasters: () => void; onProfile: () => void; onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const afterClose = useRef<(() => void) | null>(null);
  function select(action: () => void) { afterClose.current = action; setOpen(false); }
  return <nav className="bottom-navigation" aria-label="メインメニュー">
    <button type="button" aria-current={view === 'expenses' ? 'page' : undefined} onClick={() => onNavigate('expenses')}><ReceiptText aria-hidden="true" /><span>支出</span></button>
    <button type="button" aria-current={view === 'settlements' ? 'page' : undefined} onClick={() => onNavigate('settlements')}><ArrowLeftRight aria-hidden="true" /><span>立替・精算</span></button>
    <div className="mobile-add"><button type="button" className="nav-add" aria-label="支出を記録" title="支出を記録" disabled={!ready} onClick={onAdd}><Plus aria-hidden="true" /></button></div>
    <button type="button" aria-current={view === 'recurring' ? 'page' : undefined} onClick={() => onNavigate('recurring')}><span className="nav-icon"><CalendarClock aria-hidden="true" />{Boolean(attention) && <span className="attention-badge" aria-label={`確認待ち${attention}件`}>{attention! > 99 ? '99+' : attention}</span>}</span><span>予定・定期</span></button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><button type="button" aria-current={['history','notes','household'].includes(view) ? 'page' : undefined}><Menu aria-hidden="true" /><span>メニュー</span></button></SheetTrigger>
      <SheetContent side="bottom" className="workspace-menu" aria-describedby={undefined} onCloseAutoFocus={() => {
        // Let the sheet return focus before mounting the next dialog.
        const action = afterClose.current; afterClose.current = null;
        if (action) requestAnimationFrame(action);
      }}>
        <SheetHeader><SheetTitle>メニュー</SheetTitle></SheetHeader>
        <div className="workspace-menu-items">
          <button type="button" disabled={!ready} onClick={() => select(() => onNavigate('notes'))}><StickyNote aria-hidden="true" />共有メモ</button>
          <button type="button" disabled={!ready} onClick={() => select(() => onNavigate('household'))}><UsersRound aria-hidden="true" />家計の共有</button>
          <button type="button" disabled={!ready} onClick={() => select(onMasters)}><Settings2 aria-hidden="true" />マスタ管理</button>
          <button type="button" disabled={!ready} onClick={() => select(onProfile)}><UserRound aria-hidden="true" />表示名の設定</button>
          <button type="button" disabled={!ready} onClick={() => select(() => onNavigate('history'))}><History aria-hidden="true" />変更履歴</button>
          <button type="button" disabled={busy} onClick={() => select(onLogout)}><LogOut aria-hidden="true" />ログアウト</button>
        </div>
      </SheetContent>
    </Sheet>
  </nav>;
}
