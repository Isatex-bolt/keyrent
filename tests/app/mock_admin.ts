// Database simulato: registra le chiamate rpc e risponde con i gestori impostati dal test.
export const calls: { fn: string; args: Record<string, unknown> }[] = [];
export const handlers: Record<string, (a: Record<string, unknown>) => { data?: unknown; error?: { message: string } | null }> = {};
export const tables: Record<string, Record<string, unknown> | null> = {};
export function reset() { calls.length = 0; for (const k of Object.keys(handlers)) delete handlers[k]; }
export function serviceDb() {
  return {
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      calls.push({ fn, args });
      const h = handlers[fn];
      const r = h ? h(args) : { data: null };
      return { data: r.data ?? null, error: r.error ?? null };
    },
    from: (t: string) => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: tables[t] ?? null, error: null }) };
      return q;
    },
  };
}
