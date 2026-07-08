import { useState } from "react";
import { Check } from "lucide-react";
import { useFolders } from "@/context/folders-context";

const COLORS = ["#2AA198", "#E5A100", "#D0714E", "#C9527E", "#7A6FF0", "#3B8EEA", "#5AA02C", "#8C8474"];

/** Bottom-sheet modal to create a folder (name + color). */
export function NewFolderSheet({ onClose }: { onClose: () => void }) {
    const { createFolder } = useFolders();
    const [name, setName] = useState("");
    const [color, setColor] = useState(COLORS[0]);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const trimmed = name.trim();
        if (!trimmed || busy) return;
        setBusy(true);
        try {
            await createFolder(trimmed, color);
            onClose();
        } catch {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40 animate-in-up" onClick={onClose} />
            <div
                className="relative z-10 bg-[var(--color-card)] rounded-t-3xl border-t border-[var(--color-border-warm)] px-5 pt-3 pb-6"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            >
                <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[var(--color-border-warm)]" />
                <h2 className="font-serif text-2xl text-[var(--color-ink)] mb-4">New folder</h2>

                <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                    placeholder="Folder name"
                    className="w-full px-4 py-3 rounded-2xl bg-[var(--color-sidebar-active)] outline-none text-[16px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)]"
                />

                <div className="flex items-center gap-2.5 mt-4 mb-6">
                    {COLORS.map((c) => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            aria-label={`Color ${c}`}
                            className="h-8 w-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                            style={{ backgroundColor: c }}
                        >
                            {color === c && <Check size={16} className="text-white" strokeWidth={3} />}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl text-[15px] font-medium bg-[var(--color-sidebar-active)] text-[var(--color-ink)] active:scale-[0.98] transition-transform"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!name.trim() || busy}
                        className="flex-1 py-3 rounded-2xl text-[15px] font-medium bg-[var(--color-ink)] text-[var(--color-paper)] active:scale-[0.98] transition-transform disabled:opacity-40"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}
