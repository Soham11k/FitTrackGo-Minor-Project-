import { CHROME } from "@/lib/app-chrome"

/** Uppercase, tracked section label — used above every card group. */
export function SectionEyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.28em]"
      style={{ color: light ? CHROME.muted : CHROME.mutedDark }}
    >
      {children}
    </p>
  )
}
