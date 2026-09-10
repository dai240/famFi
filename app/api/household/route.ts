import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { apiError, json } from '@/lib/api';
import { dbSchema } from '@/lib/database-schema';
import { readMasters } from '@/lib/expense-service';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await requireUser();
    return json(await withUserDb(user.id, async tx => {
      const masters = await readMasters(tx);
      const members = await tx.$queryRaw<{ party_id: string; active: boolean }[]>`select * from ${dbSchema}.household_roster()`;
      return { name: masters.householdName, members: masters.parties.filter(p => members.some(m => m.party_id === p.id) || ['owner','partner'].includes(p.systemKey ?? '')).map(p => {
        const member = members.find(m => m.party_id === p.id);
        return { name: p.name, self: p.id === masters.selfPartyId, status: member ? member.active ? 'active' : 'inactive' : 'not_joined' };
      }) };
    }));
  } catch (error) { return apiError(error); }
}
