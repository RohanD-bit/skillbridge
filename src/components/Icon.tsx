const paths = {
  bridge:
    'M3 18h18M5 18V7m14 11V7M5 10c4 5 10 5 14 0M9 14v4m6-4v4M3 7h4m10 0h4',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  book: 'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1m0-14c3-2 6-2 9-1v14c-3-1-6-1-9 1V6',
  compass: 'm16 8-3 5-5 3 3-5 5-3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4m-4 9 3 3 5-6',
  leaf: 'M5 19C-1 9 10 3 21 3c0 12-5 20-13 16m-3 3L17 8',
} as const
export type IconName = keyof typeof paths
export function Icon({
  name,
  className = '',
}: {
  name: IconName
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-5 w-5 shrink-0 ${className}`}
    >
      <path d={paths[name]} />
    </svg>
  )
}
