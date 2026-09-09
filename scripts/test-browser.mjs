// Uses only the disposable test:stack, never production Auth or user records.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const base = 'http://127.0.0.1:3101';
const output = path.resolve('test-results/expense-input');
await mkdir(output, { recursive: true });
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

async function insideViewport(page, locator) {
  const box = await locator.boundingBox();
  const { width, height } = page.viewportSize();
  check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, 'Control must fit viewport');
  return box;
}

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  let page;
  try {
    const context = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', hasTouch: true });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}/login`);
    await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');
    await page.getByRole('button', { name: '確認コードを送信', exact: true }).click();
    await page.getByLabel('確認コード', { exact: true }).fill('111111');
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL('**/expenses');
    for (const [width, height] of [[320, 700], [390, 844], [430, 932], [390, 600], [844, 390], [1280, 900]]) {
      await page.setViewportSize({ width, height });
      await page.getByLabel('表示する月').fill('2026-09');
      const label = `browser-${name}-${width}-${height}`;
      console.log(`Checking ${name} ${width}x${height}`);
      await page.locator('.desktop-add:visible, .mobile-add button:visible').click();
      const dialog = page.getByRole('dialog', { name: '支出を記録', exact: true });
      await dialog.waitFor();
      await dialog.getByLabel('金額（円）').fill('750');
      await dialog.getByLabel('支出日', { exact: true }).scrollIntoViewIfNeeded();
      const dateBox = await insideViewport(page, dialog.getByLabel('支出日', { exact: true }));
      await dialog.getByRole('combobox', { name: 'カテゴリ', exact: true }).scrollIntoViewIfNeeded();
      const categoryBox = await insideViewport(page, dialog.getByRole('combobox', { name: 'カテゴリ', exact: true }));
      const boxes = await dialog.evaluate(element => {
        const date = element.querySelector('#expense-date').getBoundingClientRect();
        const category = element.querySelector('#expense-category').getBoundingClientRect();
        return { dateBottom: date.bottom, categoryTop: category.top, width: element.clientWidth, scrollWidth: element.scrollWidth };
      });
      check(dateBox.width > 0 && categoryBox.width > 0 && boxes.dateBottom <= boxes.categoryTop, 'Date and category must not overlap');
      check(boxes.scrollWidth <= boxes.width, 'Dialog must not overflow horizontally');
      await page.screenshot({ path: path.join(output, `${label}-date.png`), animations: 'disabled' });
      await dialog.getByRole('combobox', { name: 'カテゴリ', exact: true }).click();
      const options = page.getByRole('listbox');
      await options.waitFor();
      await insideViewport(page, options);
      check(await options.locator('.category-swatch').count() === await options.getByRole('option').count(), 'Every category option has a swatch');
      await page.screenshot({ path: path.join(output, `${label}-categories.png`), animations: 'disabled' });
      await page.getByRole('option', { name: 'その他', exact: true }).click();
      await dialog.getByRole('combobox', { name: 'カテゴリ', exact: true }).click();
      await page.getByRole('option', { name: '日用品', exact: true }).click();
      check(await dialog.locator('.category-select .category-swatch').evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(60, 117, 181)', 'Selected category retains its color');
      await dialog.getByRole('radiogroup').getByText('月のみ', { exact: true }).click();
      await dialog.getByLabel('支出月', { exact: true }).fill('2026-09');
      await insideViewport(page, dialog.getByLabel('支出月', { exact: true }));
      await dialog.getByLabel('内容', { exact: false }).fill(label);
      await page.screenshot({ path: path.join(output, `${label}-month.png`), animations: 'disabled' });
      await dialog.getByRole('button', { name: '保存', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.reload();
      let row = page.getByRole('button', { name: `2026年9月（月のみ） ${label} 750円を編集`, exact: true });
      await row.waitFor();
      check((await row.locator('time').innerText()).includes('月のみ'), 'Reload preserves month-only display');
      const filter = page.getByRole('combobox', { name: 'カテゴリで絞り込み' });
      await filter.click();
      await page.getByRole('option', { name: '日用品', exact: true }).click();
      await row.waitFor();
      check(await filter.locator('.category-swatch').count() === 1, 'Filter selection has color');
      await page.screenshot({ path: path.join(output, `${label}-saved.png`), fullPage: true, animations: 'disabled' });
      await row.click();
      const editor = page.getByRole('dialog', { name: '支出を編集' });
      check(await editor.getByLabel('支出月', { exact: true }).inputValue() === '2026-09', 'Editor preserves month precision');
      await editor.getByRole('radiogroup').getByText('日付指定', { exact: true }).click();
      check(await editor.getByLabel('支出日', { exact: true }).inputValue() === '', 'Switching an unknown date does not invent a day');
      await editor.getByLabel('支出日', { exact: true }).fill('2026-09-23');
      await editor.getByRole('button', { name: '保存', exact: true }).click();
      await editor.waitFor({ state: 'hidden' });
      row = page.getByRole('button', { name: `2026年9月23日 ${label} 750円を編集`, exact: true });
      await row.click();
      await editor.getByRole('radiogroup').getByText('月のみ', { exact: true }).click();
      await editor.getByLabel('支出月', { exact: true }).fill('2026-10');
      await editor.getByRole('button', { name: '保存', exact: true }).click();
      await editor.waitFor({ state: 'hidden' });
      row = page.getByRole('button', { name: `2026年10月（月のみ） ${label} 750円を編集`, exact: true });
      await row.waitFor();
      await page.getByRole('button', { name: 'CSV', exact: true }).click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: '表示月を出力', exact: true }).click();
      const download = await downloadPromise;
      const csv = await readFile(await download.path(), 'utf8');
      check(csv.includes(`"2026-10","750","日用品","${label}",""`) && csv.includes('"月のみ"'), 'Downloaded CSV preserves month-only data');
      await row.click();
      await editor.getByRole('button', { name: '削除', exact: true }).click();
      const confirmation = page.getByRole('dialog', { name: '支出を削除しますか？' });
      check((await confirmation.innerText()).includes('2026年10月（月のみ）'), 'Deletion describes the unknown day accurately');
      await confirmation.getByRole('button', { name: '削除する', exact: true }).click();
      await confirmation.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: '一覧を更新', exact: true }).waitFor();
      check(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth), 'Page must not overflow horizontally');
    }
    check(errors.length === 0, `No ${name} page errors: ${errors.join(', ')}`);
    await context.close();
  } catch (error) {
    await page?.screenshot({ path: path.join(output, `${name}-failure.png`), animations: 'disabled' });
    throw error;
  } finally { await browser.close(); }
}
console.log(`PASS: ${checks} browser layout/color/month-only CRUD/CSV checks across Chromium and WebKit; screenshots: ${output}`);
