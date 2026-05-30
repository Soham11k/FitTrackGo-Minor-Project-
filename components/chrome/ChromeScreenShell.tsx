import { CHROME } from "@/lib/app-chrome"
import { cn } from "@/lib/utils"

interface ChromeScreenShellProps {
  children: React.ReactNode
  /** dark = full black shell; cream = dark header + cream body (like Home) */
  variant?: "dark" | "cream"
  className?: string
}

/**
 * Full-height screen wrapper that sets the correct background for each tab variant.
 * - dark: everything on #0d0d0d (Run, Coach, Arena, History)
 * - cream: #f3f2ec body below a black header (Home, Train, Profile)
 */
export function ChromeScreenShell({ children, variant = "cream", className }: ChromeScreenShellProps) {
  return (
    <div
      className={cn("flex min-h-dvh flex-col pb-24", className)}
      style={{ backgroundColor: variant === "dark" ? CHROME.black : CHROME.cream }}
    >
      {children}
    </div>
  )
}
