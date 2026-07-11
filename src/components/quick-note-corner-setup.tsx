import { useCallback, useEffect, useState } from "react";
import { CornerDownRight, Check, X, Loader2, ArrowUpRight } from "lucide-react";
import { isTauri, isTauriMobile } from "@/lib/platform";

const STORAGE_KEY = "notty:qn-corner-setup"; // "fixed" | "dismissed"

async function tauriInvoke<T>(cmd: string): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke(cmd);
}

type Phase = "hidden" | "conflict" | "fixing" | "done";

/**
 * First-run coach card for the quick-note hot corner. macOS binds the
 * bottom-right corner to Apple's "Quick Note" by default, which shadows Notty's
 * corner. If we detect that clash, we surface a one-click fix (rewrites the one
 * Dock pref) with a manual fallback. Shows at most once — resolving or
 * dismissing persists so we never nag again.
 */
export function QuickNoteCornerSetup() {
    const [phase, setPhase] = useState<Phase>("hidden");
    const [error, setError] = useState<string | null>(null);

    const enabled = isTauri && !isTauriMobile;

    useEffect(() => {
        if (!enabled) return;
        if (localStorage.getItem(STORAGE_KEY)) return;
        let cancelled = false;
        // Small delay so it doesn't fight the app's first paint.
        const t = setTimeout(() => {
            tauriInvoke<boolean>("quick_note_corner_conflict")
                .then((conflict) => {
                    if (!cancelled && conflict) setPhase("conflict");
                })
                .catch((e) => console.warn("[notty] hot-corner check failed:", e));
        }, 1200);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [enabled]);

    const dismiss = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, "dismissed");
        setPhase("hidden");
    }, []);

    const freeUpCorner = useCallback(async () => {
        setError(null);
        setPhase("fixing");
        try {
            await tauriInvoke<boolean>("disable_quick_note_corner");
            localStorage.setItem(STORAGE_KEY, "fixed");
            setPhase("done");
            setTimeout(() => setPhase("hidden"), 2400);
        } catch (e) {
            console.warn("[notty] failed to free up corner:", e);
            setError("Couldn't change it automatically — try the manual way.");
            setPhase("conflict");
        }
    }, []);

    const openSettings = useCallback(() => {
        tauriInvoke("open_hot_corner_settings").catch((e) =>
            console.warn("[notty] failed to open settings:", e),
        );
    }, []);

    if (phase === "hidden") return null;

    return (
        <div
            className="fixed bottom-5 right-5 z-[95] w-[336px] select-none"
            style={{
                animation: "in-up 0.42s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
        >
            <div
                className="relative overflow-hidden rounded-2xl border border-[var(--color-border-warm)] bg-[var(--color-card)] p-5"
                style={{
                    boxShadow:
                        "0 16px 44px -12px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.08)",
                }}
            >
                {/* accent corner glow */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full"
                    style={{
                        background:
                            "radial-gradient(circle at center, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 70%)",
                    }}
                />

                <button
                    onClick={dismiss}
                    aria-label="Dismiss"
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-border-warm)]"
                >
                    <X size={14} />
                </button>

                {phase === "done" ? (
                    <div className="flex flex-col items-center py-3 text-center">
                        <span
                            className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-[var(--color-card)]"
                            style={{ backgroundColor: "var(--color-accent)" }}
                        >
                            <Check size={22} strokeWidth={2.6} />
                        </span>
                        <p className="font-serif text-lg italic text-[var(--color-ink)]">
                            corner’s all yours
                        </p>
                        <p className="mt-1 text-[13px] leading-snug text-[var(--color-ink-muted)]">
                            Sweep your mouse to the bottom-right and a quick note is a
                            click away.
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="mb-3 flex items-center gap-2.5">
                            <span
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-card)]"
                                style={{ backgroundColor: "var(--color-accent)" }}
                            >
                                <CornerDownRight size={18} strokeWidth={2.2} />
                            </span>
                            <h3 className="font-serif text-[19px] italic leading-tight text-[var(--color-ink)]">
                                free up your corner
                            </h3>
                        </div>

                        <p className="text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
                            Notty pops a quick note when you brush the{" "}
                            <span className="text-[var(--color-ink)]">bottom-right corner</span> —
                            but macOS is using that corner for Apple’s Quick Note. Want Notty to
                            take it over?
                        </p>

                        {error && (
                            <p className="mt-2.5 text-[12px] leading-snug text-[#c0674f]">
                                {error}
                            </p>
                        )}

                        <div className="mt-4 flex items-center gap-2">
                            <button
                                onClick={freeUpCorner}
                                disabled={phase === "fixing"}
                                className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-[var(--color-card)] transition-transform active:scale-[0.98] disabled:opacity-70"
                                style={{ backgroundColor: "var(--color-accent)" }}
                            >
                                {phase === "fixing" ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Freeing it up…
                                    </>
                                ) : (
                                    <>
                                        Free up the corner
                                        <ArrowUpRight
                                            size={15}
                                            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                        />
                                    </>
                                )}
                            </button>
                            <button
                                onClick={openSettings}
                                className="rounded-xl border border-[var(--color-border-warm)] px-3 py-2.5 text-[13px] text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-border-warm)]"
                            >
                                Do it myself
                            </button>
                        </div>

                        <p className="mt-2.5 text-[11px] leading-snug text-[var(--color-ink-muted)] opacity-70">
                            This changes one macOS setting and briefly restarts your Dock.
                            Apple’s Notes app keeps working.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
