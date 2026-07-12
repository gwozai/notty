mod db;
mod sync;

use tauri::{Emitter, Listener, Manager};

#[cfg(desktop)]
use tauri::WebviewWindowBuilder;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

// Logical size of the floating quick-note WINDOW. It's transparent and larger
// than the visible card so the card (anchored bottom-right in the webview) has
// headroom above/left for its shadow and the slide-in animation.
#[cfg(desktop)]
const QN_W: f64 = 470.0;
#[cfg(desktop)]
const QN_H: f64 = 600.0;
// Gap between the window and the physical screen edges.
#[cfg(desktop)]
const QN_GAP: f64 = 6.0;

/// The monitor the cursor is currently on (so the panel opens on the display the
/// user is actually pointing at), falling back to the primary monitor.
#[cfg(desktop)]
fn monitor_under_cursor(handle: &tauri::AppHandle) -> Option<tauri::Monitor> {
    let pos = handle.cursor_position().ok()?;
    let mons = handle.available_monitors().ok()?;
    mons.into_iter()
        .find(|m| {
            let mp = m.position();
            let ms = m.size();
            pos.x >= mp.x as f64
                && pos.x < mp.x as f64 + ms.width as f64
                && pos.y >= mp.y as f64
                && pos.y < mp.y as f64 + ms.height as f64
        })
        .or_else(|| handle.primary_monitor().ok().flatten())
}

/// Pin the window flush to the bottom-right corner of the active display. The
/// window itself is transparent and larger than the visible card, so the card
/// (anchored bottom-right in the webview) lands right at the corner while
/// leaving headroom above/left for the slide-in animation and its shadow.
#[cfg(desktop)]
fn place_quick_note(win: &tauri::WebviewWindow, handle: &tauri::AppHandle) {
    if let Some(m) = monitor_under_cursor(handle) {
        let scale = m.scale_factor();
        let mp = m.position();
        let ms = m.size();
        let x = mp.x as f64 + ms.width as f64 - (QN_W + QN_GAP) * scale;
        let y = mp.y as f64 + ms.height as f64 - (QN_H + QN_GAP) * scale;
        let _ = win.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
    }
}

// Show the floating quick-note window, creating it on first use. Shared by the
// global shortcut (Cmd+Alt+N), the system hot corner, and the frontend
// `toggle_quick_note` command so every entry point opens the exact same window.
// The window is a transparent, borderless, always-on-top card pinned to the
// bottom-right corner; the slide/fade animation lives in the webview so it feels
// like a native panel rather than an abrupt pop.
#[cfg(desktop)]
fn show_quick_note(handle: &tauri::AppHandle) {
    if let Some(win) = handle.get_webview_window("quick-note") {
        place_quick_note(&win, handle);
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }

    if let Ok(win) = WebviewWindowBuilder::new(
        handle,
        "quick-note",
        tauri::WebviewUrl::App("/quick-note".into()),
    )
    .title("Quick Note")
    .inner_size(QN_W, QN_H)
    .resizable(false)
    .always_on_top(true)
    .visible_on_all_workspaces(true)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .visible(false)
    .build()
    {
        // Position before the first paint so it never flashes at the wrong spot.
        place_quick_note(&win, handle);
        let _ = win.show();
        let _ = win.set_focus();
    }
}

// A real, system-wide hot corner: poll the global cursor position and summon
// the quick note the moment it lands in the bottom-right corner of whichever
// display it's on — even when Notty is in the background. This is what actually
// replaces macOS's own Quick Note hot corner (a DOM hover only fires inside our
// window, which isn't what the user reaches for at the screen edge).
#[cfg(desktop)]
fn start_hot_corner_watcher(app: &tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    // How close to the physical corner counts as "in it" (physical px).
    const MARGIN: f64 = 6.0;

    let handle = app.clone();
    let inside = Arc::new(AtomicBool::new(false));

    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(90));
        let h = handle.clone();
        let inside = inside.clone();
        // Cursor/monitor queries touch AppKit, so run them on the main thread.
        let _ = handle.run_on_main_thread(move || {
            let pos = match h.cursor_position() {
                Ok(p) => p,
                Err(_) => return,
            };

            // Find the monitor the cursor is currently on (fall back to primary)
            // so the corner works on external displays too.
            let monitor = h
                .available_monitors()
                .ok()
                .and_then(|mons| {
                    mons.into_iter().find(|m| {
                        let mp = m.position();
                        let ms = m.size();
                        pos.x >= mp.x as f64
                            && pos.x < mp.x as f64 + ms.width as f64
                            && pos.y >= mp.y as f64
                            && pos.y < mp.y as f64 + ms.height as f64
                    })
                })
                .or_else(|| h.primary_monitor().ok().flatten());

            let Some(monitor) = monitor else { return };
            let mp = monitor.position();
            let ms = monitor.size();
            let right = mp.x as f64 + ms.width as f64;
            let bottom = mp.y as f64 + ms.height as f64;

            let in_corner = pos.x >= right - MARGIN && pos.y >= bottom - MARGIN;
            // Edge-trigger: only fire on entry, not for every tick spent parked
            // in the corner.
            let was = inside.swap(in_corner, Ordering::SeqCst);
            if in_corner && !was {
                show_quick_note(&h);
            }
        });
    });
}

// Frontend entry point for the hot-corner: hovering the bottom-right corner of
// the main window reveals a button that invokes this to summon the quick note.
#[tauri::command]
fn toggle_quick_note(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        show_quick_note(&app);
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
    }
    Ok(())
}

// --- macOS hot-corner setup -------------------------------------------------
// The bottom-right screen corner is where our quick-note hot corner lives, but
// macOS ships with "Quick Note" (Apple Notes) bound to that same corner by
// default (wvous-br-corner = 14). When it's set without a modifier, a plain
// hover opens Apple Notes and shadows Notty. These commands let the app detect
// that clash and offer the user a one-click fix during onboarding.

#[cfg(target_os = "macos")]
fn read_dock_int(key: &str) -> Option<i64> {
    let out = std::process::Command::new("defaults")
        .args(["read", "com.apple.dock", key])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    String::from_utf8_lossy(&out.stdout).trim().parse::<i64>().ok()
}

/// True only when macOS would open Apple's Quick Note on a plain (modifier-free)
/// hover of the bottom-right corner — i.e. the case that actually shadows Notty.
#[tauri::command]
fn quick_note_corner_conflict() -> bool {
    #[cfg(target_os = "macos")]
    {
        let corner = read_dock_int("wvous-br-corner").unwrap_or(0);
        let modifier = read_dock_int("wvous-br-modifier").unwrap_or(0);
        // 14 = Quick Note. A non-zero modifier means Apple only fires while a
        // key is held, leaving plain hover free for Notty → not a conflict.
        corner == 14 && modifier == 0
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

/// Free up the bottom-right corner for Notty by setting it to "none" (1).
/// Only touches that one corner; the Dock must be restarted to pick it up.
#[tauri::command]
fn disable_quick_note_corner() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let ok = std::process::Command::new("defaults")
            .args(["write", "com.apple.dock", "wvous-br-corner", "-int", "1"])
            .status()
            .map_err(|e| e.to_string())?
            .success();
        if !ok {
            return Err("failed to write Dock preference".into());
        }
        // Hot-corner changes only take effect after the Dock reloads.
        let _ = std::process::Command::new("killall").arg("Dock").status();
        Ok(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

/// Manual fallback: open System Settings → Desktop & Dock (which hosts the
/// Hot Corners button) so the user can change it themselves.
#[tauri::command]
fn open_hot_corner_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.Desktop-Settings.extension")
            .status()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Open a URL in the system browser (Safari) on iOS. wry's mobile webview has no
// external-URL handling and the shell plugin's Swift `open` isn't linked into a
// manually-added plugin, so we call UIApplication.openURL directly from Rust —
// this compiles into the app's static lib, needing no plugin Swift package. Used
// for the passkey sign-in browser hop (notty.page WebAuthn → notty:// deep link).
#[tauri::command]
fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        use std::sync::mpsc;
        let (tx, rx) = mpsc::channel();
        app.run_on_main_thread(move || {
            use objc2::runtime::AnyObject;
            use objc2_foundation::{NSDictionary, NSString, NSURL};
            use objc2_ui_kit::{UIApplication, UIApplicationOpenExternalURLOptionsKey};
            let result = (|| {
                let Some(mtm) = objc2::MainThreadMarker::new() else {
                    return Err("not on main thread".to_string());
                };
                let ns = NSString::from_str(&url);
                let Some(nsurl) = (unsafe { NSURL::URLWithString(&ns) }) else {
                    return Err(format!("NSURL rejected the url: {url}"));
                };
                let application = UIApplication::sharedApplication(mtm);
                // Use the modern async opener (iOS 10+). The deprecated synchronous
                // `openURL:` is a no-op on recent iOS, which is why nothing opened.
                let options =
                    NSDictionary::<UIApplicationOpenExternalURLOptionsKey, AnyObject>::new();
                unsafe {
                    application.openURL_options_completionHandler(&nsurl, &options, None);
                }
                Ok(())
            })();
            let _ = tx.send(result);
        })
        .map_err(|e| e.to_string())?;
        // Surface the real outcome to JS so a silent no-op becomes a visible error.
        rx.recv().map_err(|e| e.to_string())??;
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = (&app, &url); // desktop/Android use their own open path
    }
    Ok(())
}

#[tauri::command]
fn open_note_in_main(app: tauri::AppHandle, note_id: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        // show()/set_focus() are desktop-only window methods; on mobile the main
        // webview is always visible, so just navigate.
        #[cfg(desktop)]
        {
            let _ = win.show();
            let _ = win.set_focus();
        }
        // Use history.pushState + popstate to trigger React Router navigation
        win.eval(&format!(
            "history.pushState(null, '', '/note/{}'); window.dispatchEvent(new PopStateEvent('popstate'));",
            note_id
        ))
        .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Main window not found".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init());

    // Global shortcuts + the floating quick-note window are desktop-only.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to get app dir");
            std::fs::create_dir_all(&app_dir).ok();

            let db = db::Database::new(&app_dir).expect("failed to init db");
            app.manage(db);

            // Markdown mirror lives in ~/Documents/Notty on desktop; on mobile
            // there is no user-facing Documents dir, so fall back to app data.
            let sync_dir = dirs::document_dir()
                .unwrap_or_else(|| app_dir.clone())
                .join("Notty");
            std::fs::create_dir_all(&sync_dir).ok();
            app.manage(sync::SyncDir(sync_dir));

            // Listen for deep link events (notty://auth?token=...)
            // Payload is a JSON array of URLs: ["notty://auth?token=xxx"]
            // Deep links carry the passkey session token back into the app on
            // both desktop and mobile, so this listener is not gated.
            let handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                if let Ok(urls) = serde_json::from_str::<Vec<String>>(event.payload()) {
                    if let Some(url) = urls.first() {
                        let _ = handle.emit("auth-deep-link", url.as_str());
                    }
                }
            });

            // Global shortcut: Cmd+Option+N → toggle quick note window (desktop only).
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();
                let shortcut: Shortcut = "CmdOrCtrl+Alt+N".parse().expect("invalid shortcut");
                app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }

                    // Shortcut toggles; the hot-corner always shows.
                    if let Some(win) = handle.get_webview_window("quick-note") {
                        if win.is_visible().unwrap_or(false) {
                            let _ = win.hide();
                        } else {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    } else {
                        show_quick_note(&handle);
                    }
                })?;

                // System-wide bottom-right hot corner (replaces Apple's).
                start_hot_corner_watcher(app.handle());
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::get_notes,
            db::get_note,
            db::save_note,
            db::move_note_to_folder,
            db::set_sync_mode,
            db::delete_note,
            db::soft_delete_note,
            db::get_trash_notes,
            db::restore_note,
            db::get_folders,
            db::save_folder,
            db::delete_folder,
            db::get_quick_notes,
            open_note_in_main,
            open_external_url,
            toggle_quick_note,
            quick_note_corner_conflict,
            disable_quick_note_corner,
            open_hot_corner_settings,
            sync::sync_to_markdown,
            sync::sync_from_markdown,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
