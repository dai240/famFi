import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { apiError,json } from '@/lib/api';
import {readAttention} from '@/lib/planning-service';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await requireUser();return json(await withUserDb(user.id,readAttention));}catch(error){return apiError(error);}}
