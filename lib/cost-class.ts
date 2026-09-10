import { z } from 'zod';
export const costClassSchema = z.enum(['fixed','variable','special','unknown']);
export const costClassLabels = {fixed:'固定費',variable:'変動費',special:'特別費',unknown:'未分類'} as const;
export type CostClass = keyof typeof costClassLabels;
