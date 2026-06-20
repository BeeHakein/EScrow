// Branded-type helper. A Brand<T, B> is structurally a T but nominally distinct,
// so a raw string can never be passed where a validated value object is required.
// Constructors live at the system boundary (src/boundary/) — never inside domain.
declare const __brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [__brand]: B };
