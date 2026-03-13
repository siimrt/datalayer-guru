export default function AppIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 90 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="pulseGrad"
          x1="0"
          y1="30"
          x2="90"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#006d77" stopOpacity="0.2" />
          <stop offset="20%" stopColor="#006d77" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#83c5be" stopOpacity="1" />
          <stop offset="80%" stopColor="#006d77" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#006d77" stopOpacity="0.2" />
        </linearGradient>
        <filter id="iconGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polyline
        points="0,30 15,30 22,30 28,18 34,42 40,8 46,52 52,20 58,38 64,30 72,30 90,30"
        stroke="rgba(0, 109, 119, 0.15)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="0,30 15,30 22,30 28,18 34,42 40,8 46,52 52,20 58,38 64,30 72,30 90,30"
        stroke="url(#pulseGrad)"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#iconGlow)"
      />
      <circle cx="40" cy="8" r="2.5" fill="#83c5be" opacity="0.9" />
    </svg>
  );
}
