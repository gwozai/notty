export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * True inside the Tauri iOS/Android webview. Desktop Tauri and plain web are
 * both false. Used to pick the cloud MobileAdapter and the mobile UI shell.
 */
export const isTauriMobile =
    isTauri && typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
