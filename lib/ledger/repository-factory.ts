'use client';

import { createApiRepositories } from './api-client-repositories';
import { createLocalStorageRepositories } from './local-storage-repositories';
import type { DataBackend } from './types';

export function getDataBackend(): DataBackend {
  return process.env.NEXT_PUBLIC_DATA_BACKEND === 'db' ? 'db' : 'local';
}

export function createClientRepositories() {
  return getDataBackend() === 'db' ? createApiRepositories() : createLocalStorageRepositories();
}
