/* eslint-disable @next/next/no-img-element */
/** Logo ufficiale KeyRent (vettoriale). `light` = versione per sfondi scuri. */
export function Logo({ light = false, className = "h-8 w-auto sm:h-9" }: { light?: boolean; className?: string }) {
  return (
    <img
      src={light ? "/brand/keyrent-logo-white.svg" : "/brand/keyrent-logo.svg"}
      alt="KeyRent"
      width={152}
      height={34}
      className={className}
      fetchPriority="high"
    />
  );
}
