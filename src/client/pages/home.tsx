import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useTabNavigate } from "@/context/tabs-context";
import { Pencil } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { NoteFileList } from "@/components/note-file-list";
import { useNotes } from "@/context/notes-context";
import { useFolders } from "@/context/folders-context";
import { useHotkeys } from "@/lib/hotkeys";
import { OfflineBanner } from "@/components/sync-status";

type SortMode = "recent" | "created";

export function HomePage() {
    const navigate = useNavigate();
    const tabNavigate = useTabNavigate();
    const { notes, loading, deleteNote } = useNotes();
    const { folders, selectedFolderId, selectFolder, renameFolder, updateFolderDescription } = useFolders();
    const [sortMode, setSortMode] = useState<SortMode>("recent");
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState("");
    const [editingDesc, setEditingDesc] = useState(false);
    const [descValue, setDescValue] = useState("");
    const nameRef = useRef<HTMLInputElement>(null);
    const descRef = useRef<HTMLTextAreaElement>(null);

    const selectedFolder = folders.find((f) => f.id === selectedFolderId);

    const filtered = selectedFolderId
        ? notes.filter((n) => n.folder_id === selectedFolderId)
        : notes;

    const sorted = useMemo(() =>
        [...filtered].sort((a, b) => {
            if (sortMode === "created") return (b.created_at || 0) - (a.created_at || 0);
            return (b.updated_at || 0) - (a.updated_at || 0);
        }),
    [filtered, sortMode]);

    useEffect(() => { setSelectedIndex((i) => Math.min(i, sorted.length - 1)); }, [sorted.length]);

    const createAndNavigate = useCallback(() => {
        const id = crypto.randomUUID();
        tabNavigate(`/note/${id}${selectedFolderId ? `?folder=${selectedFolderId}` : ""}`, { title: "New Note" });
    }, [tabNavigate, selectedFolderId]);

    useEffect(() => {
        if (selectedIndex < 0) return;
        document.querySelector(`[data-note-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [selectedIndex]);

    useHotkeys([
        { key: "n", handler: createAndNavigate },
        { key: "j", handler: () => setSelectedIndex((i) => Math.min(i + 1, sorted.length - 1)) },
        { key: "arrowdown", handler: () => setSelectedIndex((i) => Math.min(i + 1, sorted.length - 1)) },
        { key: "k", handler: () => setSelectedIndex((i) => Math.max(i - 1, 0)) },
        { key: "arrowup", handler: () => setSelectedIndex((i) => Math.max(i - 1, 0)) },
        { key: "enter", handler: () => { if (sorted[selectedIndex]) tabNavigate(`/note/${sorted[selectedIndex].id}`, { title: sorted[selectedIndex].title || "Untitled" }); } },
        { key: "x", handler: () => { if (sorted[selectedIndex]) { deleteNote(sorted[selectedIndex].id); setSelectedIndex((i) => Math.max(i - 1, 0)); } } },
        { key: "s", handler: () => setSortMode((m) => m === "recent" ? "created" : "recent") },
        { key: "/", handler: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })) },
        { key: "g", handler: () => { selectFolder(null); navigate("/"); } },
    ]);

    const heading = selectedFolder?.name || "All Notes";

    const startEditName = () => {
        if (!selectedFolder) return;
        setNameValue(selectedFolder.name);
        setEditingName(true);
        setTimeout(() => nameRef.current?.focus(), 0);
    };
    const commitName = () => {
        if (selectedFolder && nameValue.trim()) renameFolder(selectedFolder.id, nameValue.trim());
        setEditingName(false);
    };
    const startEditDesc = () => {
        if (!selectedFolder) return;
        setDescValue(selectedFolder.description || "");
        setEditingDesc(true);
        setTimeout(() => descRef.current?.focus(), 0);
    };
    const commitDesc = () => {
        if (selectedFolder) updateFolderDescription(selectedFolder.id, descValue);
        setEditingDesc(false);
    };

    return (
        <AppLayout>
            <div className="min-h-full">
                <div className="max-w-3xl mx-auto px-4 py-6 sm:px-8 sm:py-10">
                    <div className="flex items-end justify-between mb-6 sm:mb-8">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5 group/title">
                                {editingName ? (
                                    <input ref={nameRef} value={nameValue}
                                        onChange={(e) => setNameValue(e.target.value)}
                                        onBlur={commitName}
                                        onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditingName(false); }}
                                        className="font-serif text-2xl sm:text-3xl tracking-tight text-[var(--color-ink)] bg-transparent border-b-2 border-[var(--color-accent)] outline-none w-full"
                                    />
                                ) : (
                                    <>
                                        <h1 className="font-serif text-2xl sm:text-3xl tracking-tight text-[var(--color-ink)]">{heading}</h1>
                                        {selectedFolder && (
                                            <button onClick={startEditName}
                                                className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-sidebar-active)]"
                                                aria-label="Edit folder name">
                                                <Pencil size={14} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                            {selectedFolder && (
                                <div className="mt-2">
                                    {editingDesc ? (
                                        <textarea ref={descRef} value={descValue}
                                            onChange={(e) => setDescValue(e.target.value)} onBlur={commitDesc}
                                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitDesc(); } if (e.key === "Escape") setEditingDesc(false); }}
                                            rows={2} className="w-full max-w-xl text-sm text-[var(--color-ink-muted)] bg-transparent border-b border-[var(--color-accent)] outline-none resize-none"
                                            placeholder="Add a description..." />
                                    ) : (
                                        <p onClick={startEditDesc}
                                            className="text-sm text-[var(--color-ink-muted)] cursor-text max-w-xl hover:text-[var(--color-ink)] transition-colors">
                                            {selectedFolder.description || "Add a description..."}
                                        </p>
                                    )}
                                </div>
                            )}
                            <p className="text-sm text-[var(--color-ink-muted)] mt-1 font-mono">
                                {filtered.length} {filtered.length === 1 ? "file" : "files"}
                            </p>
                        </div>
                        <button onClick={createAndNavigate}
                            className="px-4 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-border-warm)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-sidebar-active)] active:scale-[0.97] transition-all duration-150 flex items-center gap-2">
                            + New note
                            <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border-warm)] font-mono opacity-60">N</kbd>
                        </button>
                    </div>

                    <div className="flex items-center gap-1 mb-4">
                        {(["recent", "created"] as const).map((mode) => (
                            <button key={mode} onClick={() => setSortMode(mode)}
                                className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                                    sortMode === mode ? "bg-[var(--color-sidebar-active)] text-[var(--color-ink)] font-medium" : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                                }`}>
                                {mode === "recent" ? "Recently accessed" : "Date created"}
                            </button>
                        ))}
                    </div>

                    {loading && sorted.length === 0 ? (
                        <div className="py-8 space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-10 rounded-lg bg-[var(--color-sidebar-active)]/40 animate-pulse" />
                            ))}
                        </div>
                    ) : sorted.length === 0 ? (
                        <div className="text-center py-24">
                            <p className="font-mono text-lg text-[var(--color-ink-muted)] mb-3">
                                {selectedFolderId ? "This folder is empty" : "No notes yet"}
                            </p>
                            <p className="text-sm text-[var(--color-ink-muted)]/70">
                                Press <kbd className="font-mono text-xs px-1 py-0.5 rounded border border-[var(--color-border-warm)]">N</kbd> to create your first note.
                            </p>
                        </div>
                    ) : (
                        <NoteFileList
                            notes={sorted}
                            selectedIndex={selectedIndex}
                            onSelect={setSelectedIndex}
                            onOpen={(note) => tabNavigate(`/note/${note.id}`, { title: note.title || "Untitled" })}
                        />
                    )}
                </div>
            </div>
            <OfflineBanner />
        </AppLayout>
    );
}
