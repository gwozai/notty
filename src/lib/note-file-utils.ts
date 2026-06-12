import type { Note } from "./adapter";

export function noteFileName(title: string | undefined | null): string {
    const name = title?.trim() || "Untitled";
    return name.endsWith(".md") ? name : `${name}.md`;
}

export function formatNoteDate(ts: number): string {
    const d = new Date(ts > 1e12 ? ts : ts * 1000);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function sortNotesByUpdated(notes: Note[]): Note[] {
    return [...notes].sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
}
