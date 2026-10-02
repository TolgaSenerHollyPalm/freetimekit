/** FreeTimeKit's own line icons, drawn after the design; the shared ones come from kitshelf-ui. */
import { lineIcon, type IconProps } from 'kitshelf-ui/ui/iconBase.ts'

export function BoltIcon({ size = 16, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <path d="M13.5 2.5L5 13.5h6.5L10.5 21.5 19 10.5h-6.5z" />
    </svg>
  )
}

export function ClockIcon({ size = 16, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function BookmarkIcon({ size = 22, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5L12 16.5l-6.5 4V5A1.5 1.5 0 0 1 7 3.5z" />
    </svg>
  )
}

export function BookmarkPlusIcon({ size = 18, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5L12 16.5l-6.5 4V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M12 7.5v6M9 10.5h6" />
    </svg>
  )
}

export function BookmarkCheckIcon({ size = 18, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5L12 16.5l-6.5 4V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M9 10.5l2.2 2.2 3.8-4.2" />
    </svg>
  )
}

export function UsersIcon({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.2a5 5 0 0 1 5 5.3" />
    </svg>
  )
}

/** A speech balloon: discussion questions, own topics, and a category the app does not know yet. */
export function ChatIcon({ size = 22, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </svg>
  )
}

export function PlayIcon({ size = 22, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.8l-10-6.5A1 1 0 0 0 8 5.5z" />
    </svg>
  )
}

export function PauseIcon({ size = 22, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <path d="M8.5 5.5v13M15.5 5.5v13" />
    </svg>
  )
}

export function WifiOffIcon({ size = 18, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <path d="M2 8.8a15 15 0 0 1 20 0M5 12.4a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18" />
    </svg>
  )
}

export function ExitIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...lineIcon(size, strokeWidth)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

const CATEGORY_SHAPES: Record<string, React.ReactNode> = {
  tarih: <path d="M3.5 9L12 4l8.5 5M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3.5 20.5h17" />,
  bilim: <path d="M9 3.5h6M10 3.5v5.8L4.9 18a2 2 0 0 0 1.7 3h10.8a2 2 0 0 0 1.7-3L14 9.3V3.5M7.2 14.5h9.6" />,
  doga: (
    <>
      <path d="M19.5 4.5C11 4.5 4.5 9 4.5 16.5c0 1.1.2 2.1.5 3 .9.3 1.9.5 3 .5 7.5 0 12-6.5 11.5-15.5z" />
      <path d="M5 19.5c2.6-4.2 6-7.6 10-10" />
    </>
  ),
  sanat: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.7-.7 1.7-1.6 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6h2a3.7 3.7 0 0 0 3.7-3.7c0-4.3-3.8-7.9-8-7.9z" />
      <circle cx="7.8" cy="11.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  teknoloji: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      <path d="M10 10h4v4h-4zM9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" />
    </>
  ),
  psikoloji: (
    <>
      <path d="M7.5 21v-4.3A7.3 7.3 0 0 1 11 3.5a7 7 0 0 1 7 6.4l1.8 3.3-1.8.7v2.4a1.9 1.9 0 0 1-1.9 1.9H14V21" />
      <circle cx="11" cy="10" r="2.3" />
    </>
  ),
}

/** A category's icon from the design; one the app does not know yet (a newer index) gets the balloon. */
export function CategoryIcon({ id, size = 22, strokeWidth = 1.8 }: IconProps & { id: string }) {
  const shape = CATEGORY_SHAPES[id]
  if (!shape) return <ChatIcon size={size} strokeWidth={strokeWidth} />
  return <svg {...lineIcon(size, strokeWidth)}>{shape}</svg>
}
