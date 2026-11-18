/** Pallino con il numero di novità; non mostra nulla se zero. */
export function Count({ n, className = "" }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span aria-label={`${n} novità`}
      className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-500 px-1.5 text-[11px] font-bold leading-none text-navy-950 ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
