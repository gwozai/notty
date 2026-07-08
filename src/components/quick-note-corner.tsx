import { useCallback, useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { isTauri, isTauriMobile } from "@/lib/platform";

async function tauriInvoke(cmd: string): Promise<void> {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(cmd);
}

/**
 * A desktop-only "hot corner": nudging the pointer into the bottom-right corner
 * of the window reveals a soft, glowing button that summons the floating quick
 * note window — the same one bound to ⌘⌥N. Purely additive; it never blocks the
 * app underneath (the wrapper is pointer-events-none, only the small corner
 * trigger and the revealed pill are interactive).
 */
export function QuickNoteCorner() {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    // Small grace delay before collapsing so a slightly-off mouse path doesn't
    // make the pill flicker away mid-reach.
    const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Desktop Tauri only — mobile has no pointer to hover, and web has no window
    // to summon. Hook order stays stable; we just render nothing below.
    const enabled = isTauri && !isTauriMobile;

    const cancelCollapse = useCallback(() => {
        if (collapseTimer.current) {
            clearTimeout(collapseTimer.current);
            collapseTimer.current = null;
        }
    }, []);

    const scheduleCollapse = useCallback(() => {
        cancelCollapse();
        collapseTimer.current = setTimeout(() => setOpen(false), 180);
    }, [cancelCollapse]);

    useEffect(() => cancelCollapse, [cancelCollapse]);

    const summon = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        try {
            await tauriInvoke("toggle_quick_note");
        } catch (e) {
            console.warn("[notty] Failed to open quick note:", e);
        } finally {
            setBusy(false);
            scheduleCollapse();
        }
    }, [busy, scheduleCollapse]);

    if (!enabled) return null;

    return (
        <div className="pointer-events-none fixed bottom-0 right-0 z-[90] select-none">
            {/* Ambient corner glow — a faint, always-present hint that brightens
                on hover so the affordance is discoverable but never loud. */}
            <div
                aria-hidden
                className="absolute bottom-0 right-0 transition-opacity duration-500 ease-out"
                style={{
                    width: 220,
                    height: 220,
                    opacity: open ? 1 : 0.5,
                    background:
                        "radial-gradient(120px 120px at bottom right, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 70%)",
                }}
            />

            {/* Interactive region: the trigger corner + the pill live here. */}
            <div
                className="pointer-events-auto absolute bottom-0 right-0 flex items-end justify-end p-4"
                style={{ width: 132, height: 132 }}
                onMouseEnter={() => {
                    cancelCollapse();
                    setOpen(true);
                }}
                onMouseLeave={scheduleCollapse}
            >
                <button
                    type="button"
                    onClick={summon}
                    aria-label="Create a quick note"
                    className="group flex items-center gap-2 rounded-full border border-[var(--color-border-warm)] bg-[var(--color-card)]/95 py-2 pl-2.5 pr-3.5 backdrop-blur-md"
                    style={{
                        transformOrigin: "bottom right",
                        transform: open
                            ? "translate(0, 0) scale(1)"
                            : "translate(10px, 10px) scale(0.82)",
                        opacity: open ? 1 : 0,
                        boxShadow: open
                            ? "0 8px 30px -6px color-mix(in srgb, var(--color-accent) 40%, transparent), 0 2px 8px rgba(0,0,0,0.12)"
                            : "0 2px 8px rgba(0,0,0,0.08)",
                        transition:
                            "transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms ease-out, box-shadow 420ms ease-out",
                        pointerEvents: open ? "auto" : "none",
                    }}
                >
                    <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-card)] transition-transform duration-300 group-hover:rotate-[-8deg] group-active:scale-90"
                        style={{ backgroundColor: "var(--color-accent)" }}
                    >
                        <NotebookPen size={15} strokeWidth={2.2} />
                    </span>
                    <span className="font-serif text-[15px] italic leading-none text-[var(--color-ink)]">
                        quick note
                    </span>
                    <kbd className="ml-0.5 font-sans text-[10px] leading-none tracking-wide text-[var(--color-ink-muted)]">
                        ⌘⌥N
                    </kbd>
                </button>
            </div>
        </div>
    );
}
