export async function navigate(page, name) {
  const nav=page.getByRole('navigation',{name:'メインメニュー',exact:true});
  if(await nav.isVisible()){
    if(['変更履歴','共有メモ','家計の共有'].includes(name)){await nav.getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('dialog',{name:'メニュー',exact:true}).getByRole('button',{name,exact:true}).click();}
    else await nav.getByRole('button',{name,exact:name!=='予定・定期'}).click();
  } else await page.getByRole('tab',{name,exact:name!=='予定・定期'}).click();
  await page.getByRole('heading',{name,exact:true}).waitFor();
}
export async function openMasters(page){
  const nav=page.getByRole('navigation',{name:'メインメニュー',exact:true});
  if(await nav.isVisible()){await nav.getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('dialog',{name:'メニュー',exact:true}).getByRole('button',{name:'マスタ管理',exact:true}).click();}
  else await page.getByRole('button',{name:'マスタ管理',exact:true}).click();
}
