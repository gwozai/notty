// Shared, dependency-free derivation of a note's display name + preview from
// its TipTap JSON. Used both server-side (DO list endpoint, debounced save) and
// client-side (editor title extraction) so they never disagree.

type TipTapNode = { type?: string; text?: string; content?: TipTapNode[] };

function blockText(node: TipTapNode): string {
    if (node.text) return node.text;
    if (!node.content) return "";
    return node.content.map(blockText).join("");
}

/**
 * Returns the note's title (first non-empty block of text) and a short preview
 * (the next few non-empty blocks, joined). Both are plain strings, safe to ship
 * in a list payload. `title` is "" only when the note has genuinely no text.
 */
export function deriveTitleAndPreview(
    content: string | object | null | undefined,
): { title: string; preview: string } {
    let doc: TipTapNode | null = null;
    try {
        doc = typeof content === "string"
            ? (content ? (JSON.parse(content) as TipTapNode) : null)
            : (content as TipTapNode | null);
    } catch {
        doc = null;
    }

    const blocks = doc?.content ?? [];
    const lines: string[] = [];
    for (const b of blocks) {
        const t = blockText(b).replace(/\s+/g, " ").trim();
        if (t) lines.push(t);
        if (lines.length >= 6) break; // enough for a title + a snippet
    }

    const title = lines[0] ?? "";
    const preview = lines.slice(1).join("  ·  ").slice(0, 160);
    return { title, preview };
}

/** Title with the "Untitled" fallback applied — for places that need a name. */
export function deriveTitle(content: string | object | null | undefined): string {
    return deriveTitleAndPreview(content).title || "Untitled";
}

/** True when the doc has no text at all (empty/blank). */
export function isEmptyDoc(content: string | object | null | undefined): boolean {
    const { title, preview } = deriveTitleAndPreview(content);
    return title === "" && preview === "";
}
