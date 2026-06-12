import type { Note } from "@/lib/adapter";
import { noteFileName, formatNoteDate } from "@/lib/note-file-utils";

// Warm the lazy editor chunk (≈250KB gzip) on hover/focus so opening a note
// doesn't wait on a cold download. Deduped — the browser caches the module.
let editorPrefetched = false;
function prefetchEditor() {
    if (editorPrefetched) return;
    editorPrefetched = true;
    import("@/components/editor").catch(() => { editorPrefetched = false; });
}

export function NoteFileList({
    notes,
    onOpen,
    selectedIndex = -1,
    onSelect,
    compact = false,
}: {
    notes: Note[];
    onOpen: (note: Note) => void;
    selectedIndex?: number;
    onSelect?: (index: number) => void;
    compact?: boolean;
}) {
    if (notes.length === 0) return null;

    return (
        <div className={compact ? "space-y-px" : "divide-y divide-[var(--color-border-warm)]/60"}>
            {notes.map((note, i) => (
                <button
                    key={note.id}
                    data-note-index={i}
                    onMouseEnter={prefetchEditor}
                    onFocus={prefetchEditor}
                    onClick={() => {
                        onSelect?.(i);
                        onOpen(note);
                    }}
                    className={`w-full flex items-center gap-3 text-left transition-colors ${
                        compact
                            ? "px-3 py-[7px] rounded-xl text-[13px]"
                            : "px-2 py-3 sm:py-3.5 text-sm"
                    } ${
                        selectedIndex === i
                            ? "bg-[var(--color-sidebar-active)] text-[var(--color-ink)]"
                            : "text-[var(--color-ink-muted)] hover:bg-[var(--color-sidebar-active)]/60 hover:text-[var(--color-ink)]"
                    }`}
                >
                    <span
                        className={`shrink-0 text-[var(--color-accent)] ${compact ? "" : "text-base"}`}
                        aria-hidden
                    >
                        #
                    </span>
                    <span className="flex-1 min-w-0">
                        <span className={`block truncate font-mono ${compact ? "" : "text-[15px]"}`}>
                            {noteFileName(note.title)}
                        </span>
                        {!compact && note.preview ? (
                            <span className="block truncate text-xs text-[var(--color-ink-muted)]/60 mt-0.5">
                                {note.preview}
                            </span>
                        ) : null}
                    </span>
                    {!compact && note.updated_at ? (
                        <span className="shrink-0 text-xs tabular-nums text-[var(--color-ink-muted)]/70">
                            {formatNoteDate(note.updated_at)}
                        </span>
                    ) : null}
                </button>
            ))}
        </div>
    );
}
