import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { useAdapter } from "@/context/adapter-context";
import { handleDeepLinkToken } from "@/lib/auth-helpers";
import type { MobileAdapter } from "@/lib/mobile-adapter";

/**
 * Reliable deep-link handling for the passkey browser round-trip on mobile.
 *
 * Uses the deep-link plugin's JS API directly instead of the Rust-emitted
 * event the desktop app relies on: `getCurrent()` catches the case where the
 * `notty://auth?token=…` link cold-started the app, and `onOpenUrl` catches
 * the warm case where the app was already running. `handleDeepLinkToken`
 * exchanges + stores the session token and reloads, so a per-mount guard is
 * enough to avoid double-handling.
 */
function useMobileDeepLinkAuth() {
    useEffect(() => {
        let unlisten: (() => void) | undefined;
        let handled = false;
        const handle = async (urls: string[] | null) => {
            if (handled || !urls) return;
            const url = urls.find((u) => u.startsWith("notty://"));
            if (!url) return;
            handled = true;
            await handleDeepLinkToken(url);
        };
        import("@tauri-apps/plugin-deep-link")
            .then(async (dl) => {
                try {
                    await handle(await dl.getCurrent());
                } catch {}
                unlisten = await dl.onOpenUrl((urls) => handle(urls));
            })
            .catch(() => {});
        return () => unlisten?.();
    }, []);
}

function PasskeyIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
            <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
        </svg>
    );
}

function Splash() {
    return (
        <div className="min-h-[100dvh] bg-[var(--color-paper)] flex flex-col items-center justify-center gap-3">
            <h1 className="font-serif italic text-4xl text-[var(--color-ink)]">notty</h1>
            <div className="h-1 w-1 rounded-full bg-[var(--color-accent)] animate-pulse" />
        </div>
    );
}

function MobileSignIn() {
    const adapter = useAdapter() as MobileAdapter;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const signIn = async () => {
        setError(null);
        setBusy(true);
        try {
            // Opens the system browser for the WebAuthn ceremony on notty.page.
            // A notty:// deep link returns and reloads the app, signed in.
            await adapter.startPasskeySignIn();
        } catch (e: any) {
            setError(e?.message || "Couldn't start passkey sign-in.");
            setBusy(false);
        }
    };

    return (
        <div
            className="min-h-[100dvh] bg-[var(--color-paper)] flex flex-col items-center justify-center px-8 text-center"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="max-w-xs w-full space-y-6">
                <div className="space-y-2">
                    <h1 className="font-serif italic text-5xl text-[var(--color-ink)]">notty</h1>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                        Your notes, synced everywhere. Sign in with a passkey to continue.
                    </p>
                </div>
                <button
                    onClick={signIn}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[15px] font-medium bg-[var(--color-ink)] text-[var(--color-paper)] active:scale-[0.97] transition-transform disabled:opacity-60"
                >
                    <PasskeyIcon />
                    {busy ? "Continue in browser…" : "Sign in with Passkey"}
                </button>
                {busy && (
                    <p className="text-xs text-[var(--color-ink-muted)]">
                        Finish signing in the browser — you'll return here automatically.
                    </p>
                )}
                {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
        </div>
    );
}

/**
 * Gates the mobile app behind a passkey session. Also mounts the deep-link
 * listener so a returning `notty://auth?token=...` is exchanged and stored.
 */
export function MobileAuthGate({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    useMobileDeepLinkAuth();

    if (loading) return <Splash />;
    if (!user) return <MobileSignIn />;
    return <>{children}</>;
}
