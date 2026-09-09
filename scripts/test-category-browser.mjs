// Uses only the disposable loopback stack; never production accounts or data.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const base = 'http://127.0.0.1:3101';
const output = path.resolve('test-results/category-selection');
await mkdir(output, { recursive: true });
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const combo = (scope, name) => scope.getByRole('combobox', { name, exact: true });
async function choose(page, scope, label, name) {
  await combo(scope, label).click();
  await page.getByRole('option', { name, exact: true }).click();
}
async function fit(page, scope) {
  check(await scope.evaluate(el => el.scrollWidth <= el.clientWidth), 'Container has no horizontal overflow');
  check(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), 'Page fits viewport');
}
async function inViewport(page, locator) {
  const box = await locator.boundingBox(), size = page.viewportSize();
  check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, 'Control fits viewport');
}
async function save(editor) {
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
}
async function reloadWorkspace(page) {
  await page.reload();
  await combo(page, 'カテゴリで絞り込み').waitFor();
}
for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  let page;
  try {
    const context = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', hasTouch: true });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('dialog', dialog => dialog.accept());
    await page.goto(base + '/login');
    await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');
    await page.getByRole('button', { name: '確認コードを送信', exact: true }).click();
    await page.getByLabel('確認コード', { exact: true }).fill('111111');
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL('**/expenses');
    const parent = { id: randomUUID(), name: 'カテゴリ選択確認 ' + engineName + ' ' + Date.now().toString().slice(-6), color: '#3C75B5', parentId: null, sortOrder: 9000, archived: false };
    const child = { id: randomUUID(), name: '長い詳細カテゴリの名前でも途中で切れずに一覧から確認して選べることを確かめる', color: '#B35F79', parentId: parent.id, sortOrder: 0, archived: false };
    const sibling = { ...child, id: randomUUID(), name: 'もうひとつの詳細', sortOrder: 1 };
    for (const row of [parent, child, sibling]) {
      const response = await page.request.post(base + '/api/categories', { headers: { origin: base }, data: row });
      check(response.status() === 201, 'Fixture category created through authorized API: ' + await response.text());
    }
    await reloadWorkspace(page);
    let index = 0, lastLabel = '';
    for (const [width, height] of [[320, 700], [390, 844], [390, 600], [844, 390], [1280, 900]]) {
      index++;
      const month = `${engineName === 'chromium' ? '2040' : '2041'}-0${index}`;
      const label = `${engineName}-${width}-${height}-${Date.now()}`;
      lastLabel = label;
      console.log('Checking categories ' + engineName + ' ' + width + 'x' + height);
      await page.setViewportSize({ width, height });
      await page.getByLabel('表示する月').fill(month);
      await page.locator('.desktop-add:visible, .mobile-add button:visible').click();
      let editor = page.getByRole('dialog', { name: '支出を記録', exact: true });
      await editor.waitFor();
      check((await combo(editor, 'カテゴリ').innerText()).includes('食費'), 'Default parent retained');
      check((await combo(editor, '詳細カテゴリ').innerText()).includes('指定なし'), 'Parent-only default');
      await combo(editor, 'カテゴリ').click();
      const options = page.getByRole('listbox');
      check(!((await options.innerText()).includes('食材')), 'Parent dropdown contains no child names');
      await inViewport(page, options);
      await page.screenshot({ path: path.join(output, label + '-parents.png'), animations: 'disabled' });
      await page.keyboard.press('Escape');
      await choose(page, editor, '詳細カテゴリ', '外食');
      await choose(page, editor, 'カテゴリ', '日用品');
      check((await combo(editor, '詳細カテゴリ').innerText()).includes('指定なし'), 'Parent change clears previous child');
      await combo(editor, '詳細カテゴリ').click();
      check(!((await options.innerText()).includes('外食')), 'Only selected parent children are offered');
      await page.keyboard.press('Escape');
      await choose(page, editor, 'カテゴリ', 'その他');
      check(await combo(editor, '詳細カテゴリ').count() === 0, 'No detail field for a parent without children');
      await choose(page, editor, 'カテゴリ', parent.name);
      await combo(editor, '詳細カテゴリ').click();
      await inViewport(page, options);
      await fit(page, options);
      const longOption = page.getByRole('option', { name: child.name, exact: true });
      check(await longOption.locator('.category-choice > span').evaluate(el => el.scrollWidth <= el.clientWidth), 'Long option name wraps without clipping');
      await page.screenshot({ path: path.join(output, label + '-details.png'), animations: 'disabled' });
      await longOption.click();
      check(await combo(editor, 'カテゴリ').locator('.category-swatch').evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(60, 117, 181)', 'Parent retains its color');
      check(await combo(editor, '詳細カテゴリ').locator('.category-swatch').evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(179, 95, 121)', 'Child retains its own color');
      await fit(page, editor);
      await inViewport(page, editor.getByRole('button', { name: '保存', exact: true }));
      await page.screenshot({ path: path.join(output, label + '-selected.png'), animations: 'disabled' });
      await editor.getByLabel('金額（円）').fill('1200');
      await editor.getByLabel('内容', { exact: false }).fill('詳細あり ' + label);
      await editor.getByRole('radio', { name: '月のみ', exact: true }).check();
      await editor.getByLabel('支出月', { exact: true }).fill(month);
      await save(editor);
      const first = await (await page.request.get(base + '/api/expenses?month=' + month)).json();
      const saved = first.expenses.find(row => row.description === '詳細あり ' + label);
      check(saved?.categoryId === child.id, 'Only the selected leaf ID is persisted');
      await reloadWorkspace(page);
      await page.getByLabel('表示する月').fill(month);
      const expenseRow = page.getByRole('button', { name: new RegExp('詳細あり ' + label + ' 1200円を編集') });
      await expenseRow.click();
      editor = page.getByRole('dialog', { name: '支出を編集', exact: true });
      check((await combo(editor, 'カテゴリ').innerText()).includes(parent.name), 'Editing restores parent');
      check((await combo(editor, '詳細カテゴリ').innerText()).includes(child.name), 'Editing restores child');
      await editor.getByRole('button', { name: '複製して新しく記録', exact: true }).click();
      editor = page.getByRole('dialog', { name: '支出を記録', exact: true });
      check((await combo(editor, '詳細カテゴリ').innerText()).includes(child.name), 'Duplication preserves child');
      await combo(editor, '詳細カテゴリ').press('Space');
      await page.getByRole('listbox').waitFor();
      await page.keyboard.press('Home');
      await page.waitForFunction(() => document.activeElement?.textContent === '指定なし');
      await page.keyboard.press('Enter');
      await combo(editor, '詳細カテゴリ').getByText('指定なし', { exact: true }).waitFor();
      check((await combo(editor, '詳細カテゴリ').innerText()).includes('指定なし'), 'Keyboard can clear detail without submitting the form');
      await editor.getByLabel('内容', { exact: false }).fill('親のみ ' + label);
      await editor.getByLabel('金額（円）').fill('800');
      await save(editor);
      let data = await (await page.request.get(base + '/api/expenses?month=' + month)).json();
      const parentExpense = data.expenses.find(row => row.description === '親のみ ' + label);
      check(parentExpense?.categoryId === parent.id, 'Unspecified detail saves the parent ID');
      await choose(page, page, 'カテゴリで絞り込み', parent.name);
      await page.getByRole('heading', { name: '支出履歴 2件', exact: true }).waitFor();
      check((await combo(page, '詳細カテゴリで絞り込み').innerText()).includes('すべての詳細カテゴリ'), 'Parent filter includes parent and all children');
      await choose(page, page, '詳細カテゴリで絞り込み', child.name);
      await page.getByRole('heading', { name: '支出履歴 1件', exact: true }).waitFor();
      await expenseRow.waitFor();
      await fit(page, page.locator('.ledger-filter-actions'));
      await page.screenshot({ path: path.join(output, label + '-filter.png'), fullPage: true, animations: 'disabled' });
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'CSV', exact: true }).click();
      await page.getByRole('menuitem', { name: '絞り込み結果を出力', exact: true }).click();
      const csv = await readFile(await (await downloadPromise).path(), 'utf8');
      check(csv.includes(saved.id) && !csv.includes(parentExpense.id) && csv.includes(parent.name + ' / ' + child.name), 'Filtered CSV uses child ID and full path');
      await choose(page, page, '詳細カテゴリで絞り込み', 'すべての詳細カテゴリ');
      await page.getByRole('heading', { name: '支出履歴 2件', exact: true }).waitFor();
      await choose(page, page, 'カテゴリで絞り込み', 'すべてのカテゴリ');
      check(await combo(page, '詳細カテゴリで絞り込み').count() === 0, 'Clearing parent removes detail filter');
      await page.getByRole('tab', { name: '定期支出', exact: true }).click();
      const recurring = page.locator('.recurring-workspace');
      await recurring.getByLabel('定期支出の表示月').fill(month);
      await recurring.getByRole('button', { name: '追加', exact: true }).click();
      const ruleEditor = page.getByRole('dialog', { name: '定期支出を追加', exact: true });
      const ruleName = '定期 ' + label;
      await ruleEditor.getByLabel('名称', { exact: true }).fill(ruleName);
      await choose(page, ruleEditor, 'カテゴリ', parent.name);
      await choose(page, ruleEditor, '詳細カテゴリ', child.name);
      await ruleEditor.getByLabel('定期支出の金額（円）').fill('500');
      await save(ruleEditor);
      const item = recurring.locator('.recurring-list > li').filter({ hasText: ruleName });
      await item.getByRole('button', { name: ruleName + 'の設定を編集', exact: true }).click();
      const editRule = page.getByRole('dialog', { name: '定期支出を編集', exact: true });
      check((await combo(editRule, 'カテゴリ').innerText()).includes(parent.name) && (await combo(editRule, '詳細カテゴリ').innerText()).includes(child.name), 'Recurring editor restores both levels');
      await editRule.getByRole('button', { name: 'キャンセル', exact: true }).click();
      await item.getByRole('button', { name: 'この月を登録', exact: true }).click();
      const confirmation = page.getByRole('dialog', { name: ruleName + 'を登録', exact: true });
      check((await combo(confirmation, '詳細カテゴリ').innerText()).includes(child.name), 'Period confirmation preserves category selection');
      await fit(page, confirmation);
      await save(confirmation);
      const periods = await (await page.request.get(base + '/api/recurring?month=' + month)).json();
      const rule = periods.rules.find(row => row.name === ruleName);
      const occurrence = periods.occurrences.find(row => row.ruleId === rule.id);
      const posted = await (await page.request.get(base + '/api/expenses/' + occurrence.expenseId)).json();
      check(rule.categoryId === child.id && posted.categoryId === child.id, 'Recurring schedule and posted expense keep selected child');
      await page.getByRole('tab', { name: '支出', exact: true }).click();
    }
    // Archive only disposable categories; existing linked expenses must remain editable.
    const current = await (await page.request.get(base + '/api/categories')).json();
    const rows = Array.isArray(current) ? current : current.categories;
    const version = rows.find(row => row.id === parent.id).version;
    const { id, ...fields } = parent;
    const archived = await page.request.put(base + '/api/categories/' + id, { headers: { origin: base }, data: { ...fields, archived: true, version } });
    check(archived.status() === 200, 'Fixture parent archived');
    await reloadWorkspace(page);
    const finalMonth = `${engineName === 'chromium' ? '2040' : '2041'}-05`;
    await page.getByLabel('表示する月').fill(finalMonth);
    await page.getByRole('button', { name: new RegExp('詳細あり ' + lastLabel + ' 1200円を編集') }).click();
    const archivedEditor = page.getByRole('dialog', { name: '支出を編集', exact: true });
    check((await combo(archivedEditor, 'カテゴリ').innerText()).includes('使用停止'), 'Archived parent remains visible');
    check((await combo(archivedEditor, '詳細カテゴリ').innerText()).includes(child.name), 'Child under archived parent remains selected');
    await combo(archivedEditor, '詳細カテゴリ').click();
    check(await page.getByRole('option', { name: '指定なし', exact: true }).getAttribute('aria-disabled') === 'true', 'Cannot switch a child to an unavailable archived parent');
    check(await page.getByRole('option', { name: sibling.name, exact: true }).count() === 0, 'Other children of archived parent cannot be newly chosen');
    await page.keyboard.press('Escape');
    await save(archivedEditor);
    await page.locator('.desktop-add:visible, .mobile-add button:visible').click();
    const newEditor = page.getByRole('dialog', { name: '支出を記録', exact: true });
    await combo(newEditor, 'カテゴリ').click();
    check(await page.getByRole('option', { name: parent.name + '（使用停止）', exact: true }).count() === 0, 'Archived parent hidden for new entries');
    await page.keyboard.press('Escape');
    await newEditor.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await choose(page, page, 'カテゴリで絞り込み', parent.name + '（使用停止）');
    await choose(page, page, '詳細カテゴリで絞り込み', child.name + '（使用停止）');
    await page.getByRole('heading', { name: '支出履歴 2件', exact: true }).waitFor();
    check(errors.length === 0, 'No browser errors: ' + errors.join(', '));
    await context.close();
  } catch (error) {
    await page?.screenshot({ path: path.join(output, engineName + '-failure.png'), animations: 'disabled' });
    throw error;
  } finally { await browser.close(); }
}
console.log(`PASS: ${checks} two-stage category UI/persistence/CSV/recurring/archive/keyboard checks; ${output}`);
