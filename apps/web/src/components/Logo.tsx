export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none" aria-label="KeyRent">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill={light ? "#12c2b5" : "#0b1f3a"} />
        <circle cx="12" cy="16" r="5" fill="none" stroke={light ? "#0b1f3a" : "#12c2b5"} strokeWidth="2.6" />
        <path d="M17 16h9M22 16v3.5M25 16v2.5" stroke={light ? "#0b1f3a" : "#12c2b5"} strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <span className={`text-[19px] font-bold tracking-tight ${light ? "text-white" : "text-navy-900"}`}>
        Key<span className="text-teal-500">Rent</span>
      </span>
    </span>
  );
}
