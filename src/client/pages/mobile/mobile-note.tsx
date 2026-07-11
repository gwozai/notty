import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Share2, Trash2, Lock } from "lucide-react";
import { Editor } from "@/components/editor";
import { ShareDialog } from "@/components/share-dialog";
import { useNotes } from "@/context/notes-context";
import { useAdapter } from "@/context/adapter-context";
import { useAuth } from "@/context/auth-context";

export function MobileNotePage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { deleteNote } = useNotes();
    const adapter = useAdapter();
    const { user, loading: authLoading } = useAuth();

    const folderId = searchParams.get("folder") ?? undefined;
    const saveGuardRef = useRef(false);
    const [showShare, setShowShare] = useState(false);
    const [state, setState] = useState<"checking" | "locked" | "ready">("checking");

    useEffect(() => {
        if (!id || authLoading || !user) return;
        adapter
            .getNoteMeta(id)
            .then((meta) => setState(meta?.locked ? "locked" : "ready"))
            .catch(() => setState("ready"));
    }, [id, adapter, authLoading, user]);

    // Keyboard-aware height: track the visual viewport so the editor fills exactly
    // the space *above* the software keyboard. Without this the screen stays a
    // keyboard-agnostic 100dvh — content hides behind the keyboard, the caret
    // drifts off-screen, and the uncovered strip shows a black bar.
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const apply = () => {
            document.documentElement.style.setProperty("--kb-vh", `${vv.height}px`);
        };
        apply();
        vv.addEventListener("resize", apply);
        vv.addEventListener("scroll", apply);
        return () => {
            vv.removeEventListener("resize", apply);
            vv.removeEventListener("scroll", apply);
            document.documentElement.style.removeProperty("--kb-vh");
        };
    }, []);

    if (!id) return null;

    // Prefer history (returns you to wherever you opened the note from — Home,
    // Search, etc.); fall back to Home on a cold deep-link with no history.
    const handleBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/m"));
    const handleDelete = () => {
        deleteNote(id);
        navigate("/m");
    };

    return (
        <div
            className="bg-[var(--color-paper)] flex flex-col overflow-hidden"
            style={{ height: "var(--kb-vh, 100dvh)" }}
        >
            <header
                className="shrink-0 z-30 flex items-center justify-between px-2 py-2 bg-[var(--color-paper)]/85 backdrop-blur-xl border-b border-[var(--color-border-warm)]/60"
                style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
            >
                <button
                    onClick={handleBack}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[var(--color-ink-muted)] active:bg-[var(--color-sidebar-active)] transition-colors"
                    aria-label="Back to notes"
                >
                    <ArrowLeft size={20} />
                    <span className="font-serif italic text-[15px]">notty</span>
                </button>
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => setShowShare(true)}
                        className="p-2 rounded-lg text-[var(--color-ink-muted)] active:bg-[var(--color-sidebar-active)] transition-colors"
                        aria-label="Share"
                    >
                        <Share2 size={19} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-2 rounded-lg text-red-500 active:bg-red-500/10 transition-colors"
                        aria-label="Delete note"
                    >
                        <Trash2 size={19} />
                    </button>
                </div>
            </header>

            {/* Momentum-scrolling editor region. Native iOS rubber-band bounce is
                preserved (no overscroll-contain), and the generous bottom padding
                gives headspace so the active line can scroll up to the middle of
                the screen rather than being pinned to the bottom edge. */}
            <div
                className="flex-1 overflow-y-auto"
                style={{ WebkitOverflowScrolling: "touch" }}
            >
                {state === "locked" ? (
                    <div className="flex flex-col items-center justify-center gap-3 px-8 pt-32 text-center">
                        <Lock size={28} className="text-[var(--color-ink-muted)]" />
                        <p className="font-serif text-xl text-[var(--color-ink)]">This note is locked</p>
                        <p className="text-sm text-[var(--color-ink-muted)] max-w-xs">
                            Passkey-locked notes can be unlocked on notty.page or the desktop app.
                        </p>
                    </div>
                ) : state === "checking" ? (
                    <div className="pt-24 text-center text-sm text-[var(--color-ink-muted)]">Loading…</div>
                ) : (
                    <div
                        className="pt-2"
                        style={{ paddingBottom: "max(45vh, calc(env(safe-area-inset-bottom) + 33vh))" }}
                    >
                        <Editor noteId={id} folderId={folderId} saveGuardRef={saveGuardRef} compact />
                    </div>
                )}
            </div>

            {showShare && <ShareDialog noteId={id} onClose={() => setShowShare(false)} />}
        </div>
    );
}
