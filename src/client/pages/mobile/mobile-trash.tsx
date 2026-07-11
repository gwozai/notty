import { useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { useNotes } from "@/context/notes-context";
import { timeAgo } from "@/components/mobile/mobile-shell";
import { deriveTitleAndPreview } from "@/lib/note-preview";

export function MobileTrashPage() {
    const navigate = useNavigate();
    const { trash, loadTrash, restoreNote, permanentlyDeleteNote, emptyTrash } = useNotes();

    useEffect(() => {
        loadTrash(true);
    }, [loadTrash]);

    return (
        <div className="min-h-[100dvh] bg-[var(--color-paper)] flex flex-col">
            <header
                className="sticky top-0 z-30 flex items-center justify-between px-2 py-2 bg-[var(--color-paper)]/85 backdrop-blur-xl border-b border-[var(--color-border-warm)]/60"
                style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
            >
                <button
                    onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/m/settings"))}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[var(--color-ink-muted)] active:bg-[var(--color-sidebar-active)] transition-colors"
                    aria-label="Back"
                >
                    <ArrowLeft size={20} />
                    <span className="font-serif text-[16px]">Trash</span>
                </button>
                {trash.length > 0 && (
                    <button
                        onClick={emptyTrash}
                        className="text-[13px] px-3 py-1.5 rounded-lg text-red-500 active:bg-red-500/10 transition-colors font-medium"
                    >
                        Empty
                    </button>
                )}
            </header>

            <div className="flex-1 px-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
                {trash.length === 0 ? (
                    <div className="text-center pt-28 px-8">
                        <Trash2 size={26} className="mx-auto text-[var(--color-ink-muted)]/60 mb-3" />
                        <p className="font-serif italic text-xl text-[var(--color-ink)]">Trash is empty</p>
                        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Deleted notes show up here.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-[var(--color-border-warm)]/60 pt-1">
                        {trash.map((note) => {
                            const { title, preview } = deriveTitleAndPreview(note.content || "");
                            return (
                                <li key={note.id} className="flex items-center gap-2 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-[15px] text-[var(--color-ink)] truncate">
                                            {title || note.title || "Untitled"}
                                        </p>
                                        <p className="mt-0.5 text-[12px] text-[var(--color-ink-muted)] truncate">
                                            {preview || `Deleted ${note.deleted_at ? timeAgo(note.deleted_at) : ""}`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => restoreNote(note.id)}
                                        className="shrink-0 p-2 rounded-lg text-[var(--color-accent)] active:bg-[var(--color-accent)]/10 transition-colors"
                                        aria-label="Restore"
                                    >
                                        <RotateCcw size={18} />
                                    </button>
                                    <button
                                        onClick={() => permanentlyDeleteNote(note.id)}
                                        className="shrink-0 p-2 rounded-lg text-red-500 active:bg-red-500/10 transition-colors"
                                        aria-label="Delete forever"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
