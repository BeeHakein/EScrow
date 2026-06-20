import type { Result } from '../../../domain/shared/result';

// The repo ports return `T | null` / `T`, not Result — "not found" is null, but a row that
// fails to parse is data CORRUPTION, an exceptional condition. So unlike the user/AI boundaries
// (which return Result the caller must handle), the DB boundary throws on a parse failure.
export function orThrow<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`persisted row failed to parse back into a domain type: ${r.error}`);
  return r.value;
}
