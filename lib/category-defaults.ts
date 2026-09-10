import type { Category } from './ledger';
import type { CostClass } from './cost-class';
const parents: Record<string,{name:string;cost:CostClass}> = {
  food:{name:'食費',cost:'variable'}, daily:{name:'日用品',cost:'variable'},
  housing:{name:'住居',cost:'fixed'}, utilities:{name:'水道・光熱',cost:'fixed'}, communication:{name:'通信',cost:'fixed'},
};
const children: Record<string,Record<string,CostClass>> = {
  food:{'食材':'variable','外食':'variable','持ち帰り':'variable'}, daily:{'消耗品':'variable','生活雑貨':'variable'},
  utilities:{'電気':'fixed','ガス':'fixed','水道':'fixed'}, communication:{'スマホ':'fixed','インターネット':'fixed'},
  housing:{'家賃・住宅ローン':'fixed'}, transport:{'車両購入':'special','自動車ローン':'fixed'},
};
export function suggestedCategoryCost(category: Category): CostClass|null {
  if(category.archived || category.costClass && category.costClass!=='unknown') return null;
  if(category.parentId)return children[category.parentId]?.[category.name]??null;
  const preset=parents[category.id];return preset?.name===category.name?preset.cost:null;
}
