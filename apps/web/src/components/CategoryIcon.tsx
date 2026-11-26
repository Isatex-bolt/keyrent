const paths: Record<string, string> = {
  auto: "M5 16l1.5-5A2 2 0 018.4 9.5h7.2a2 2 0 011.9 1.5L19 16M4 16h16v3H4zM7 19v1.5M17 19v1.5",
  moto: "M5.5 17a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zM13.5 17a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zM8 17l3-6h3l2 6M14 11l1-3h2",
  bici: "M4 16.5a3 3 0 106 0 3 3 0 00-6 0zM14 16.5a3 3 0 106 0 3 3 0 00-6 0zM7 16.5l3-6h4l3 6M10 10.5L9 8h-2M14 10.5l-2 6",
  camper: "M3 17V8a1 1 0 011-1h11l4 4v6zM3 13h16M7 17.5a1.5 1.5 0 103 0M14 17.5a1.5 1.5 0 103 0M6 9h4v3H6z",
  barche: "M4 15l1.5 3h13l1.5-3zM12 4v11M12 5l5 8h-5",
  furgoni: "M3 7h11v9H3zM14 10h4l3 3v3h-7M6 17.5a1.5 1.5 0 103 0M16 17.5a1.5 1.5 0 103 0",
  ncc: "M4 15l1.5-4.5A2 2 0 017.4 9h9.2a2 2 0 011.9 1.5L20 15M3 15h18v3H3zM6 18v1.5M18 18v1.5M9 6h6",
  jet: "M2 13l8-1 4-7h2l-2 7 6 .5 2-2.5h1l-1 4 1 4h-1l-2-2.5-6 .5 2 7h-2l-4-7-8-1z",
  elicotteri: "M3 5h18M12 5v3M6 11a6 4 0 0012 0 6 4 0 00-12 0zM18 11h4M22 9v4M9 15l-1 3M15 15l1 3M6 18h12",
  "quad-motoslitte": "M4 17a2 2 0 104 0 2 2 0 00-4 0zM16 17a2 2 0 104 0 2 2 0 00-4 0zM6 15l2-4h8l2 4M10 11l1-3h3",
};

export function CategoryIcon({ slug, className = "h-6 w-6" }: { slug: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[slug] ?? paths.auto} />
    </svg>
  );
}
