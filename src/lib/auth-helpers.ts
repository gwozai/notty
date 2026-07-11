import { isTauriMobile } from "@/lib/platform";

export async function signInWithPasskeyTauri() {
    // On iOS the shell plugin's native `open` isn't linked into the app (only
    // its Rust side ships; the Swift `ShellPlugin.open` never gets compiled for
    // a manually-added plugin), and wry's mobile webview has no `window.open`
    // handler — so neither the shell plugin nor `window.open` can reach Safari.
    // Instead we call our own native `open_external_url` command, which invokes
    // `UIApplication.openURL` directly. Mobile always talks to notty.page so the
    // origin is fixed.
    if (isTauriMobile) {
        const { invoke } = await import("@tauri-apps/api/core");
        // Percent-encode the redirect: an unencoded `notty://auth` in the query
        // makes iOS's strict NSURL parser reject the whole string (→ nothing
        // opens). The passkey page reads it back via URLSearchParams, which
        // decodes automatically.
        const redirect = encodeURIComponent("notty://auth");
        await invoke("open_external_url", {
            url: `https://notty.page/auth/passkey?redirect=${redirect}`,
        });
        return;
    }
    // Desktop: the shell plugin's native open works and honours a custom cloudUrl.
    const { getDesktopSettings } = await import("@/lib/desktop-settings");
    const settings = await getDesktopSettings();
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(`${settings.cloudUrl}/auth/passkey?redirect=notty://auth`);
}

export async function handleDeepLinkToken(url: string) {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    if (!token) return;
    const { getDesktopSettings } = await import("@/lib/desktop-settings");
    const settings = await getDesktopSettings();
    const res = await fetch(`${settings.cloudUrl}/api/auth/exchange-token?token=${token}`);
    if (!res.ok) return;
    const data = await res.json() as { sessionToken?: string };
    if (data.sessionToken) {
        const { load } = await import("@tauri-apps/plugin-store");
        const store = await load("settings.json");
        await store.set("sessionToken", data.sessionToken);
        await store.save();
        // Reset cloud detection so the new token gets picked up
        const { resetCloudDetection } = await import("@/lib/desktop-adapter");
        resetCloudDetection();
    }
    window.location.reload();
}
