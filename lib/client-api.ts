export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, cache: 'no-store', credentials: 'same-origin',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new RequestError(response.status, data.error ?? '処理に失敗しました。');
  return data as T;
}
export function errorMessage(error: unknown) {
  return error instanceof RequestError ? error.message : '通信できませんでした。接続を確認して、もう一度お試しください。';
}
