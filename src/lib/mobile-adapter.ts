import type { User } from "./adapter";
import { WebAdapter } from "./web-adapter";
import { getDesktopSettings } from "./desktop-settings";
import { signInWithPasskeyTauri } from "./auth-helpers";

/**
 * Adapter for the Tauri mobile app (iOS / Android).
 *
 * The mobile webview runs on `tauri://localhost`, so same-origin cookies to
 * `notty.page` are impossible. Instead we reuse the exact passkey flow the
 * desktop app uses: the system browser performs the WebAuthn ceremony on
 * notty.page, then a `notty://auth?token=...` deep link hands a one-time token
 * back, which is exchanged for a long-lived session token stored in the Tauri
 * store. Every request re-targets the cloud origin and carries that token via
 * the `X-Session-Token` header (the server converts it to a session cookie).
 *
 * Note data flows over REST exactly like the desktop app — the editor never
 * opens a collaboration WebSocket on Tauri (`editor.tsx` gates `connect()` on
 * `!isTauri`); `getNote` seeds content and `saveNote` persists it — so no
 * WebSocket wiring is required here.
 */
export class MobileAdapter extends WebAdapter {
    protected apiBase = "https://notty.page";

    /** Cached session token; kept in sync with the Tauri store. */
    private token: string | null = null;
    private tokenLoaded = false;

    /** Load the session token from the Tauri store once, then cache it. */
    private async ensureToken(): Promise<string | null> {
        if (this.tokenLoaded) return this.token;
        try {
            const settings = await getDesktopSettings();
            this.token = settings.sessionToken;
            if (settings.cloudUrl) this.apiBase = settings.cloudUrl;
        } catch {
            this.token = null;
        }
        this.tokenLoaded = true;
        return this.token;
    }

    protected async authHeaders(): Promise<Record<string, string>> {
        const token = await this.ensureToken();
        return token ? { "X-Session-Token": token } : {};
    }

    protected async wsAuthQuery(): Promise<string> {
        // The events WebSocket (subscribeToNoteEvents, inherited from WebAdapter)
        // can't send an X-Session-Token header and tauri://localhost has no
        // cookie, so pass the session token via ?token= (getSession accepts it).
        const token = await this.ensureToken();
        return token ? `&token=${encodeURIComponent(token)}` : "";
    }

    protected mediaQuery(): string {
        // `getMediaUrl` is synchronous; rely on the token cached by an earlier
        // `getSession()`. Media only renders once a session exists, so by the
        // time an <img> resolves this the token is populated.
        return this.token ? `?token=${encodeURIComponent(this.token)}` : "";
    }

    async getSession(): Promise<User | null> {
        const token = await this.ensureToken();
        if (!token) return null; // No token yet → show the sign-in screen.
        try {
            const res = await this.request("/api/auth/get-session", {
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
                const data = (await res.json()) as { user?: User } | null;
                if (data?.user) return data.user;
            }
        } catch {
            // Offline with a stored token — assume still signed in so the app
            // renders from cache instead of bouncing to the sign-in screen.
            return { id: "mobile", name: "Notty" };
        }
        return null;
    }

    /**
     * Auto sign-in fallback (called by AuthProvider when no session exists) is
     * a no-op on mobile: we never want to pop the system browser on launch.
     * The sign-in screen calls {@link startPasskeySignIn} on an explicit tap.
     */
    async signIn(): Promise<User | null> {
        return null;
    }

    /** Explicit, user-initiated passkey sign-in via the system browser. */
    async startPasskeySignIn(): Promise<void> {
        await signInWithPasskeyTauri();
    }

    async signOut(): Promise<void> {
        try {
            const { load } = await import("@tauri-apps/plugin-store");
            const store = await load("settings.json");
            await store.delete("sessionToken");
            await store.save();
        } catch {}
        this.token = null;
        this.tokenLoaded = true;
    }

    async verifyLock(): Promise<{ lockToken: string }> {
        // Passkey-gated unlock needs an in-page WebAuthn ceremony, which the
        // tauri://localhost origin can't perform. Direct the user to web/desktop.
        throw new Error("Unlock passkey-locked notes on notty.page or the desktop app.");
    }
}
