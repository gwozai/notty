import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, ChevronRight, FolderPlus } from "lucide-react";
import { useNotes } from "@/context/notes-context";
import { useFolders } from "@/context/folders-context";
import { MobileShell, MobileHeader, timeAgo } from "@/components/mobile/mobile-shell";
import { deriveTitleAndPreview } from "@/lib/note-preview";
import { NewFolderSheet } from "@/components/mobile/new-folder-sheet";

export function MobileHomePage() {
    const navigate = useNavigate();
    const { notes, loading } = useNotes();
    const { folders, selectedFolderId, selectFolder } = useFolders();
    const [sortMode] = useState<"recent">("recent");
    const [showNewFolder, setShowNewFolder] = useState(false);

    const filtered = selectedFolderId ? notes.filter((n) => n.folder_id === selectedFolderId) : notes;
    const sorted = useMemo(
        () => [...filtered].sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0)),
        [filtered, sortMode]
    );

    const createNote = () => {
        const id = crypto.randomUUID();
        navigate(`/m/note/${id}${selectedFolderId ? `?folder=${selectedFolderId}` : ""}`);
    };

    return (
        <MobileShell>
            <MobileHeader
                title="Notes"
                subtitle={`${filtered.length} ${filtered.length === 1 ? "note" : "notes"}`}
            />

            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-5 py-3">
                <Chip active={!selectedFolderId} onClick={() => selectFolder(null)} label="All" />
                {folders.map((f) => (
                    <Chip
                        key={f.id}
                        active={selectedFolderId === f.id}
                        onClick={() => selectFolder(f.id)}
                        label={f.name}
                        dot={f.color}
                    />
                ))}
                <button
                    onClick={() => setShowNewFolder(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap border border-dashed border-[var(--color-border-warm)] text-[var(--color-ink-muted)] active:bg-[var(--color-sidebar-active)] transition-colors"
                >
                    <FolderPlus size={14} />
                    New folder
                </button>
            </div>

            <div className="px-4">
                {loading && sorted.length === 0 ? (
                    <div className="space-y-2 pt-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-[68px] rounded-2xl bg-[var(--color-sidebar-active)]/40 animate-pulse" />
                        ))}
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="text-center pt-28 px-8">
                        <p className="font-serif italic text-2xl text-[var(--color-ink)] mb-2">Nothing here yet</p>
                        <p className="text-sm text-[var(--color-ink-muted)]">
                            Tap the <span className="text-[var(--color-accent)]">+</span> button to write your first note.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-[var(--color-border-warm)]/60">
                        {sorted.map((note) => {
                            const { title, preview } = deriveTitleAndPreview(note.content || "");
                            const displayTitle = title || note.title || "Untitled";
                            const displayPreview = preview || note.preview || "";
                            return (
                                <li key={note.id}>
                                    <button
                                        onClick={() => navigate(`/m/note/${note.id}`)}
                                        className="w-full flex items-center gap-3 py-3.5 px-1 text-left active:bg-[var(--color-sidebar-active)]/40 rounded-xl transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <p className="font-medium text-[15.5px] text-[var(--color-ink)] truncate">
                                                    {displayTitle}
                                                </p>
                                                <span className="shrink-0 text-[11px] font-mono text-[var(--color-ink-muted)]">
                                                    {timeAgo(note.updated_at)}
                                                </span>
                                            </div>
                                            {displayPreview ? (
                                                <p className="mt-0.5 text-[13px] text-[var(--color-ink-muted)] truncate">
                                                    {displayPreview}
                                                </p>
                                            ) : (
                                                <p className="mt-0.5 text-[13px] italic text-[var(--color-ink-muted)]/60">
                                                    No additional text
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight size={16} className="shrink-0 text-[var(--color-ink-muted)]/50" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Floating action button */}
            <button
                onClick={createNote}
                aria-label="New note"
                className="fixed right-5 z-40 h-14 w-14 rounded-full bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/30 flex items-center justify-center active:scale-90 transition-transform"
                style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
            >
                <Plus size={26} strokeWidth={2.4} />
            </button>

            {showNewFolder && <NewFolderSheet onClose={() => setShowNewFolder(false)} />}
        </MobileShell>
    );
}

function Chip({
    active,
    onClick,
    label,
    dot,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    dot?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors ${
                active
                    ? "bg-[var(--color-ink)] text-[var(--color-paper)] font-medium"
                    : "bg-[var(--color-sidebar-active)] text-[var(--color-ink-muted)]"
            }`}
        >
            {dot && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />}
            {label}
        </button>
    );
}
