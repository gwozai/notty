import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { NotebookText, Search, Settings } from "lucide-react";

const TABS = [
    { to: "/m", label: "Notes", icon: NotebookText, match: (p: string) => p === "/m" || p.startsWith("/m/note") },
    { to: "/m/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/m/search") },
    { to: "/m/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/m/settings") },
];

/** Bottom tab bar with iOS/Android safe-area padding. */
export function MobileTabBar() {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--color-border-warm)] bg-[var(--color-paper)]/85 backdrop-blur-xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="flex items-stretch justify-around px-2 pt-1.5 pb-1">
                {TABS.map(({ to, label, icon: Icon, match }) => {
                    const active = match(pathname);
                    return (
                        <button
                            key={to}
                            onClick={() => navigate(to)}
                            className="flex flex-1 flex-col items-center gap-0.5 py-1.5 rounded-xl active:scale-[0.94] transition-transform"
                            aria-label={label}
                            aria-current={active ? "page" : undefined}
                        >
                            <Icon
                                size={22}
                                strokeWidth={active ? 2.4 : 1.8}
                                className={active ? "text-[var(--color-accent)]" : "text-[var(--color-ink-muted)]"}
                            />
                            <span
                                className={`text-[10.5px] tracking-wide ${
                                    active ? "text-[var(--color-accent)] font-semibold" : "text-[var(--color-ink-muted)]"
                                }`}
                            >
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

/** Full-height mobile screen wrapper: safe-area top, scrollable body, tab bar. */
export function MobileShell({ children, tabBar = true }: { children: ReactNode; tabBar?: boolean }) {
    return (
        <div className="min-h-[100dvh] bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col">
            <div
                className="flex-1"
                style={{ paddingBottom: tabBar ? "calc(env(safe-area-inset-bottom) + 68px)" : undefined }}
            >
                {children}
            </div>
            {tabBar && <MobileTabBar />}
        </div>
    );
}

/** Sticky, blurred header used across mobile screens. */
export function MobileHeader({
    title,
    subtitle,
    right,
}: {
    title: ReactNode;
    subtitle?: ReactNode;
    right?: ReactNode;
}) {
    return (
        <header
            className="sticky top-0 z-30 bg-[var(--color-paper)]/85 backdrop-blur-xl border-b border-[var(--color-border-warm)]/70"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
            <div className="flex items-end justify-between gap-3 px-5 pt-3 pb-3">
                <div className="min-w-0">
                    <h1 className="font-serif text-[26px] leading-none tracking-tight text-[var(--color-ink)]">{title}</h1>
                    {subtitle && <p className="mt-1.5 text-xs font-mono text-[var(--color-ink-muted)]">{subtitle}</p>}
                </div>
                {right && <div className="shrink-0 flex items-center gap-1">{right}</div>}
            </div>
        </header>
    );
}

/** Compact relative-time label ("2h", "3d", "Just now"). */
export function timeAgo(ts: number): string {
    if (!ts) return "";
    const ms = ts > 1e12 ? ts : ts * 1000;
    const diff = Date.now() - ms;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "Just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    const d = new Date(ms);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
