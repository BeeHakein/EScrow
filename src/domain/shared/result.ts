// Boundary outcome type. Parsing and validation return a Result instead of throwing,
// so every caller must handle the failure path — no exceptions cross the boundary.
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E = string>(error: E): Result<never, E> => ({ ok: false, error });
