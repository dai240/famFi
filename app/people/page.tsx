import Link from 'next/link';

export default function PeoplePage() {
  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">FamFi MVP</p>
        <h1>家族管理は後回しにしています。</h1>
        <p className="lead">父/母の固定選択で家計簿を先に使えるようにしています。</p>
        <p style={{ marginTop: 20 }}><Link href="/">トップページを開く</Link></p>
      </section>
    </main>
  );
}
