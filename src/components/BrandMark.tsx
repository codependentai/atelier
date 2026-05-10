export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="2.75"
        width="13.5"
        height="15.5"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.55"
      />
      <rect x="3.5" y="5.75" width="13.5" height="15.5" rx="2.5" fill="currentColor" />
    </svg>
  )
}
