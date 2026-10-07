export type MonthSnapshot = {
  month: string; total: number; count: number; sampleCount: number; summaryRemainder: number;
  cardConfirmed?: boolean;
  costs: { costClass: string; amount: number }[];
  categories: { categoryId: string; name: string; color: string; amount: number }[];
};
export type ExpenseComparison = { current: MonthSnapshot; previous: MonthSnapshot | null };
export function compareMonths({ current, previous }: ExpenseComparison) {
  const currentKnown = Boolean(current.count || current.summaryRemainder || current.cardConfirmed);
  const previousKnown = Boolean(previous && (previous.count || previous.summaryRemainder || previous.cardConfirmed));
  const available = currentKnown && previousKnown;
  const confirmed = Boolean(current.cardConfirmed && previous?.cardConfirmed);
  const delta = previous ? current.total - previous.total : 0;
  return {
    available, delta, confirmed, currentKnown, previousKnown,
    percent: available && confirmed && previous!.total > 0 ? delta / previous!.total * 100 : null,
    costs: current.costs.map(c => ({ ...c, delta: c.amount - (previous?.costs.find(p => p.costClass === c.costClass)?.amount ?? 0) })),
    categories: [...new Set([...current.categories,...(previous?.categories??[])].map(c => c.categoryId))].map(id => {
      const currentCategory = current.categories.find(c=>c.categoryId===id), old = previous?.categories.find(c=>c.categoryId===id);
      return { ...(currentCategory??old!), delta: (currentCategory?.amount??0)-(old?.amount??0) };
    }).filter(c=>c.delta>0).sort((a,b)=>b.delta-a.delta||a.categoryId.localeCompare(b.categoryId)).slice(0,3),
  };
}
