import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Search, X } from "lucide-react";
import { useNotes } from "@/context/notes-context";
import { MobileShell, timeAgo } from "@/components/mobile/mobile-shell";
import { deriveTitleAndPreview } from "@/lib/note-preview";

export function MobileSearchPage() {
    const navigate = useNavigate();
    const { notes } = useNotes();
    const [query, setQuery] = useState("");

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return notes
            .map((n) => ({ note: n, ...deriveTitleAndPreview(n.content || "") }))
            .filter(({ note, title, preview }) => {
                const hay = `${title} ${preview} ${note.title ?? ""} ${note.preview ?? ""}`.toLowerCase();
                return hay.includes(q);
            })
            .sort((a, b) => (b.note.updated_at || 0) - (a.note.updated_at || 0))
            .slice(0, 50);
    }, [query, notes]);

    return (
        <MobileShell>
            <div
                className="sticky top-0 z-30 bg-[var(--color-paper)]/85 backdrop-blur-xl border-b border-[var(--color-border-warm)]/70 px-4 pb-3"
                style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
            >
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[var(--color-sidebar-active)]">
                    <Search size={18} className="text-[var(--color-ink-muted)] shrink-0" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search notes"
                        className="flex-1 bg-transparent outline-none text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)]"
                        autoCapitalize="none"
                        autoCorrect="off"
                    />
                    {query && (
                        <button onClick={() => setQuery("")} aria-label="Clear" className="shrink-0 text-[var(--color-ink-muted)]">
                            <X size={17} />
                        </button>
                    )}
                </div>
            </div>

            <div className="px-4">
                {!query.trim() ? (
                    <p className="text-center text-sm text-[var(--color-ink-muted)] pt-24">
                        Search across all your notes.
                    </p>
                ) : results.length === 0 ? (
                    <p className="text-center text-sm text-[var(--color-ink-muted)] pt-24">
                        No matches for “{query.trim()}”.
                    </p>
                ) : (
                    <ul className="divide-y divide-[var(--color-border-warm)]/60 pt-1">
                        {results.map(({ note, title, preview }) => (
                            <li key={note.id}>
                                <button
                                    onClick={() => navigate(`/m/note/${note.id}`)}
                                    className="w-full flex items-baseline justify-between gap-3 py-3.5 px-1 text-left active:bg-[var(--color-sidebar-active)]/40 rounded-xl transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-[15px] text-[var(--color-ink)] truncate">
                                            {title || note.title || "Untitled"}
                                        </p>
                                        {preview && (
                                            <p className="mt-0.5 text-[13px] text-[var(--color-ink-muted)] truncate">{preview}</p>
                                        )}
                                    </div>
                                    <span className="shrink-0 text-[11px] font-mono text-[var(--color-ink-muted)]">
                                        {timeAgo(note.updated_at)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </MobileShell>
    );
}
