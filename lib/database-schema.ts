import 'server-only';
import { Prisma } from '@prisma/client';
import { databaseEnvironment } from './database-environment';

// SQL identifiers are from a server-only allowlist, never request input.
export const dbSchema = Prisma.raw('"' + databaseEnvironment().schema + '"');
