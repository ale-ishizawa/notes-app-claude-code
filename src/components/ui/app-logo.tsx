interface AppLogoProps {
  size?: number
  className?: string
}

export function AppLogo({ size = 48, className }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Back note (offset for depth) */}
      <rect x="20" y="25" width="56" height="65" rx="9" fill="#FB923C" stroke="#111" strokeWidth="3.5" />
      {/* Front note */}
      <rect x="12" y="15" width="58" height="67" rx="9" fill="#FBBF24" stroke="#111" strokeWidth="3.5" />
      {/* Lines */}
      <line x1="23" y1="33" x2="57" y2="33" stroke="#111" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="23" y1="45" x2="57" y2="45" stroke="#111" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="23" y1="57" x2="57" y2="57" stroke="#111" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="23" y1="69" x2="57" y2="69" stroke="#111" strokeWidth="2.8" strokeLinecap="round" />
      {/* Cyan plus circle */}
      <circle cx="69" cy="22" r="18" fill="#22D3EE" stroke="#111" strokeWidth="3.5" />
      <line x1="69" y1="12" x2="69" y2="32" stroke="#111" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="59" y1="22" x2="79" y2="22" stroke="#111" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
