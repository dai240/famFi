import Link from 'next/link';

export default function HouseholdPage() {
  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">FamFi MVP</p>
        <h1>家計簿MVPはトップページに移動しました。</h1>
        <p className="lead">支出、入金、月次サマリをまず使える形に絞っています。</p>
        <p style={{ marginTop: 20 }}><Link href="/">トップページを開く</Link></p>
      </section>
    </main>
  );
}
