import Link from 'next/link';

export default function ManagementPage() {
  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">FamFi MVP</p>
        <h1>管理機能は後回しにしています。</h1>
        <p className="lead">カテゴリはまず文字列入力で運用できます。</p>
        <p style={{ marginTop: 20 }}><Link href="/">トップページを開く</Link></p>
      </section>
    </main>
  );
}
