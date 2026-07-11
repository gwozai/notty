import { useState, useEffect, useCallback, useRef } from "react";
import { Editor } from "@/components/editor";
import { type Note } from "@/context/notes-context";
import { useAuth } from "@/context/auth-context";
import { flushNote } from "@/lib/note-flush";
import { ChevronLeft, ChevronRight, Plus, X, ExternalLink } from "lucide-react";

const QUICK_FOLDER = "__quick_notes__";
// Keep in sync with the exit transition duration below.
const EXIT_MS = 210;

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke(cmd, args);
}

async function hideWindow() {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    getCurrentWindow().hide();
}


export function QuickNotePage() {
    // The window is transparent so only the card shows. Kill the global paper
    // background + the body noise texture for this route, and sync the theme
    // (a separate webview doesn't inherit the main window's class).
    useEffect(() => {
        const theme = localStorage.getItem("theme");
        document.documentElement.classList.toggle("dark", theme === "dark");
        const style = document.createElement("style");
        style.textContent =
            "html,body{background:transparent !important}body::before{display:none !important}";
        document.head.appendChild(style);
        return () => {
            style.remove();
        };
    }, []);

    const { user } = useAuth();
    const [quickNotes, setQuickNotes] = useState<Note[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loaded, setLoaded] = useState(false);
    // Drives the slide/scale/fade. Starts closed so every show animates in.
    const [open, setOpen] = useState(false);
    const closingRef = useRef(false);
    // Don't gate the editor on auth forever — after a short grace period, let
    // the user type. Saves are local-first on desktop; auth issues surface in
    // the main app, not by bricking the widget on "Loading...".
    const [authGraceOver, setAuthGraceOver] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setAuthGraceOver(true), 3000);
        return () => clearTimeout(t);
    }, []);
    const quickNotesRef = useRef(quickNotes);
    quickNotesRef.current = quickNotes;
    const currentIndexRef = useRef(currentIndex);
    currentIndexRef.current = currentIndex;

    const loadQuickNotes = useCallback(async () => {
        const notes: Note[] = await tauriInvoke("get_quick_notes");
        // Keep the note the user is currently viewing in view even though the DB
        // list may have reordered or gained/lost rows — otherwise a refresh
        // silently jumps them to a different note mid-cycle.
        const curId = quickNotesRef.current[currentIndexRef.current]?.id;
        setQuickNotes(notes);
        if (curId) {
            const idx = notes.findIndex((n) => n.id === curId);
            setCurrentIndex(idx >= 0 ? idx : (i) => Math.min(i, Math.max(0, notes.length - 1)));
        }
        return notes;
    }, []);

    const addNewNote = useCallback(async () => {
        // Persist whatever's in the current note before swapping the editor out.
        const cur = quickNotesRef.current[currentIndexRef.current];
        if (cur) await flushNote(cur.id).catch(() => {});
        const id = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);
        // Lazy: do NOT write an empty row here. The editor upserts the row on the
        // first real keystroke, so abandoned blank notes never accumulate and a
        // stale empty create can't clobber content that was typed later.
        const newNote: Note = {
            id,
            title: "Untitled",
            content: "",
            folder_id: QUICK_FOLDER,
            created_at: now,
            updated_at: now,
        };
        setQuickNotes((prev) => [newNote, ...prev]);
        setCurrentIndex(0);
    }, []);

    useEffect(() => {
        loadQuickNotes()
            .then((notes) => {
                if (notes.length === 0) addNewNote();
            })
            .catch((e) => {
                // Don't strand the widget on "Loading..." if the DB read fails —
                // start a fresh note so the user can still write.
                console.warn("[notty] Failed to load quick notes:", e);
                addNewNote();
            })
            .finally(() => setLoaded(true));
    }, []);

    // Play the entrance on first mount even if the focus event is missed.
    useEffect(() => {
        const id = requestAnimationFrame(() => setOpen(true));
        return () => cancelAnimationFrame(id);
    }, []);

    // Mount the (heavy) editor a beat AFTER the entrance starts, so its
    // synchronous parse/layout never competes with the slide-in — that's the
    // difference between buttery and janky. It fades in once the card is settled.
    const [revealed, setRevealed] = useState(false);
    useEffect(() => {
        if (!open) {
            setRevealed(false);
            return;
        }
        const t = setTimeout(() => setRevealed(true), 200);
        return () => clearTimeout(t);
    }, [open]);

    // Animate out, then hide the OS window. Guarded so the blur that hiding
    // itself triggers doesn't re-enter.
    const triggerClose = useCallback(() => {
        if (closingRef.current) return;
        closingRef.current = true;
        setOpen(false);
        setTimeout(() => hideWindow(), EXIT_MS);
    }, []);

    // Native-feeling behavior: a re-show (hot corner / ⌘⌥N) re-plays the entrance
    // and refreshes notes; clicking away (losing focus) dismisses it.
    useEffect(() => {
        let unlisten: (() => void) | undefined;
        (async () => {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            unlisten = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
                if (focused) {
                    closingRef.current = false;
                    setOpen(true);
                    loadQuickNotes().catch(() => {});
                } else {
                    triggerClose();
                }
            });
        })();
        return () => unlisten?.();
    }, [loadQuickNotes, triggerClose]);

    // Switch notes, but FLUSH the current note's pending save first so a quick
    // ⌘]/⌘[ before the 1.5s debounce can't drop what was just typed.
    const switchBy = useCallback((delta: number) => {
        const notes = quickNotesRef.current;
        const n = notes.length;
        if (n < 2) return;
        const cur = notes[currentIndexRef.current];
        const move = () => setCurrentIndex((i) => (i + delta + n) % n);
        tauriInvoke("debug_log", { msg: `switchBy delta=${delta} from=${cur?.id?.slice(0,8)} count=${n}` }).catch(() => {});
        if (cur) flushNote(cur.id).then(() => tauriInvoke("debug_log", { msg: `flush done ${cur.id.slice(0,8)}` }).catch(() => {})).catch(() => {}).finally(move);
        else move();
    }, []);

    const prev = useCallback(() => switchBy(-1), [switchBy]);
    const next = useCallback(() => switchBy(1), [switchBy]);

    const openInMain = useCallback(async () => {
        const note = quickNotesRef.current[currentIndexRef.current];
        if (!note) return;
        setOpen(false);
        await new Promise((r) => setTimeout(r, EXIT_MS));
        await tauriInvoke("open_note_in_main", { noteId: note.id });
        hideWindow();
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") { e.preventDefault(); triggerClose(); }
            if (e.metaKey && e.key === "[") { e.preventDefault(); prev(); }
            if (e.metaKey && e.key === "]") { e.preventDefault(); next(); }
            if (e.metaKey && e.key === "n") { e.preventDefault(); addNewNote(); }
            if (e.metaKey && e.key === "o") { e.preventDefault(); openInMain(); }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [prev, next, addNewNote, openInMain, triggerClose]);

    const currentNote = quickNotes[currentIndex];
    const ready = loaded && (!!user || authGraceOver);

    return (
        <div
            className="h-screen w-screen flex items-end justify-end pr-3.5 pb-3.5 bg-transparent overflow-hidden"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) triggerClose();
            }}
        >
            <div
                className="flex flex-col bg-[var(--color-paper)] rounded-[20px] overflow-hidden border border-[var(--color-border-warm)]"
                style={{
                    width: 400,
                    height: 520,
                    transformOrigin: "100% 100%",
                    transform: open ? "translateY(0) scale(1)" : "translateY(26px) scale(0.92)",
                    opacity: open ? 1 : 0,
                    transition: open
                        ? "transform 520ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease-out"
                        : `transform ${EXIT_MS}ms cubic-bezier(0.4,0,1,1), opacity ${EXIT_MS - 40}ms ease-in`,
                    boxShadow: "0 24px 56px -20px rgba(0,0,0,0.45), 0 8px 20px -10px rgba(0,0,0,0.18)",
                    willChange: "transform, opacity",
                }}
            >
                {/* Draggable title bar */}
                <div
                    className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border-warm)] select-none shrink-0"
                    data-tauri-drag-region
                >
                    <span className="text-xs text-[var(--color-ink-muted)] font-serif italic pointer-events-none">
                        quick note
                    </span>

                    <div className="flex items-center gap-0.5">
                        {quickNotes.length > 1 && (
                            <>
                                <button onClick={prev} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-border-warm)] transition-colors">
                                    <ChevronLeft size={12} className="text-[var(--color-ink-muted)]" />
                                    <kbd className="text-[9px] text-[var(--color-ink-muted)] opacity-60">⌘[</kbd>
                                </button>
                                <span className="text-[10px] text-[var(--color-ink-muted)] tabular-nums min-w-[2rem] text-center">
                                    {currentIndex + 1}/{quickNotes.length}
                                </span>
                                <button onClick={next} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-border-warm)] transition-colors">
                                    <kbd className="text-[9px] text-[var(--color-ink-muted)] opacity-60">⌘]</kbd>
                                    <ChevronRight size={12} className="text-[var(--color-ink-muted)]" />
                                </button>
                            </>
                        )}
                        <div className="w-px h-3 bg-[var(--color-border-warm)] mx-1" />
                        <button onClick={addNewNote} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-border-warm)] transition-colors">
                            <Plus size={12} className="text-[var(--color-ink-muted)]" />
                            <kbd className="text-[9px] text-[var(--color-ink-muted)] opacity-60">⌘N</kbd>
                        </button>
                        <button onClick={openInMain} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-border-warm)] transition-colors">
                            <ExternalLink size={12} className="text-[var(--color-ink-muted)]" />
                            <kbd className="text-[9px] text-[var(--color-ink-muted)] opacity-60">⌘O</kbd>
                        </button>
                        <button onClick={triggerClose} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-border-warm)] transition-colors">
                            <X size={12} className="text-[var(--color-ink-muted)]" />
                            <kbd className="text-[9px] text-[var(--color-ink-muted)] opacity-60">esc</kbd>
                        </button>
                    </div>
                </div>

                {/* Editor / loading */}
                <div className="flex-1 overflow-auto">
                    {ready && revealed && currentNote ? (
                        <div style={{ animation: "in-up 0.28s ease-out" }}>
                            <Editor
                                key={currentNote.id}
                                noteId={currentNote.id}
                                folderId={QUICK_FOLDER}
                                compact
                            />
                        </div>
                    ) : (
                        !ready && (
                            <div className="h-full flex items-center justify-center text-sm text-[var(--color-ink-muted)]">
                                Loading…
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
