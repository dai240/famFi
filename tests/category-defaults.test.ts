import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestedCategoryCost } from '../lib/category-defaults';
import type { Category } from '../lib/ledger';
test('cost presets are conservative, name-matched and do not override explicit choices',()=>{
  const food:Category={id:'food',name:'食費',color:'#16806a',sortOrder:1,parentId:null,archived:false,version:1,costClass:'unknown'};
  assert.equal(suggestedCategoryCost(food),'variable');
  assert.equal(suggestedCategoryCost({...food,costClass:'special'}),null);
  assert.equal(suggestedCategoryCost({...food,archived:true}),null);
  assert.equal(suggestedCategoryCost({...food,name:'Custom'}),null);
  assert.equal(suggestedCategoryCost({...food,id:'other',name:'その他'}),null);
  assert.equal(suggestedCategoryCost({...food,id:'child',parentId:'transport',name:'車両購入'}),'special');
  assert.equal(suggestedCategoryCost({...food,id:'child',parentId:'transport',name:'自動車ローン'}),'fixed');
  assert.equal(suggestedCategoryCost({...food,id:'transport',name:'交通'}),null);
});
