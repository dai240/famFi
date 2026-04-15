import Link from 'next/link';

export default function HouseworkPage() {
  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">FamFi MVP</p>
        <h1>家事管理は後回しにしています。</h1>
        <p className="lead">今回のブランチでは家計簿だけに集中しています。</p>
        <p style={{ marginTop: 20 }}><Link href="/">トップページを開く</Link></p>
      </section>
    </main>
  );
}
