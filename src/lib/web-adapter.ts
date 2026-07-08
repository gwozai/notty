import type * as Y from "yjs";
import type { NottyAdapter, Note, NoteVersion, NoteBranch, NoteTree, User, Folder, Share, SharedNote, Profile, MediaItem, SaveResult, SessionHandle, NoteEvent } from "./adapter";
import { NottyProvider } from "./yjs-provider";
import { authClient } from "./auth-client";

async function assertOk(res: Response, context: string) {
    if (!res.ok) {
        // A 401 mid-session means the session cookie died under us. Tell the
        // auth layer to recover instead of letting every save silently loop.
        if (res.status === 401) {
            try { window.dispatchEvent(new CustomEvent("notty:auth-expired")); } catch {}
        }
        const err = new Error(`${context}: ${res.status} ${res.statusText}`);
        (err as any).status = res.status;
        throw err;
    }
}

// IndexedDB-backed cache for the notes list so the PWA works offline
const IDB_STORE = "notty-pwa-cache";

async function getCachedNotes(): Promise<Note[]> {
    try {
        const db = await openCache();
        return await idbGet<Note[]>(db, "notes") ?? [];
    } catch { return []; }
}

async function setCachedNotes(notes: Note[]): Promise<void> {
    try {
        const db = await openCache();
        await idbPut(db, "notes", notes);
    } catch {}
}

async function getCachedFolders(): Promise<Folder[]> {
    try {
        const db = await openCache();
        return await idbGet<Folder[]>(db, "folders") ?? [];
    } catch { return []; }
}

async function setCachedFolders(folders: Folder[]): Promise<void> {
    try {
        const db = await openCache();
        await idbPut(db, "folders", folders);
    } catch {}
}

function openCache(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_STORE, 1);
        req.onupgradeneeded = () => req.result.createObjectStore("kv");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction("kv", "readonly");
        const req = tx.objectStore("kv").get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbPut(db: IDBDatabase, key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction("kv", "readwrite");
        const req = tx.objectStore("kv").put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export class WebAdapter implements NottyAdapter {
    /**
     * Base origin for all API calls. Empty string on web means same-origin
     * (cookies flow automatically). Subclasses (e.g. the Tauri mobile adapter,
     * whose webview runs on tauri://localhost) point this at the cloud origin.
     */
    protected apiBase = "";

    /**
     * Extra headers merged into every API request. Web sends none — the session
     * rides on the same-origin cookie. Token-based clients override this to add
     * `X-Session-Token`.
     */
    protected async authHeaders(): Promise<Record<string, string>> {
        return {};
    }

    /**
     * Single choke point for every REST call so subclasses can re-target the
     * origin and inject auth. Behaviour on web is identical to a bare `fetch`.
     */
    protected async request(path: string, init?: RequestInit): Promise<Response> {
        const extra = await this.authHeaders();
        if (Object.keys(extra).length === 0) {
            return fetch(this.apiBase + path, init);
        }
        const headers = new Headers(init?.headers);
        for (const [k, v] of Object.entries(extra)) headers.set(k, v);
        return fetch(this.apiBase + path, { ...init, headers });
    }

    async getSession(): Promise<User | null> {
        try {
            const session = await authClient.getSession();
            return (session.data?.user as User) ?? null;
        } catch {
            // Offline — return cached local user so the app still renders
            return { id: "offline", name: "Offline" };
        }
    }

    async signIn(): Promise<User | null> {
        const res = await authClient.signIn.anonymous();
        return (res.data?.user as User) ?? null;
    }

    async signOut(): Promise<void> {
        await authClient.signOut();
    }

    async getCachedNotesList(): Promise<Note[]> {
        const cached = await getCachedNotes();
        return cached.map((n) => ({ ...n, content: "" }));
    }

    async getNotesList(): Promise<Note[]> {
        try {
            const res = await this.request("/api/notes/list");
            await assertOk(res, "Failed to fetch notes list");
            const list: Note[] = ((await res.json()) as Note[]).map((n) => ({ ...n, content: "" }));
            const existing = await getCachedNotes();
            const contentById = new Map(existing.map((n) => [n.id, n.content]));
            setCachedNotes(list.map((n) => ({ ...n, content: contentById.get(n.id) ?? "" })));
            return list;
        } catch {
            return this.getCachedNotesList();
        }
    }

    async getNotes(): Promise<Note[]> {
        try {
            const res = await this.request("/api/notes");
            await assertOk(res, "Failed to fetch notes");
            const notes: Note[] = await res.json();
            setCachedNotes(notes);
            return notes;
        } catch {
            // Offline — serve from IndexedDB cache
            return getCachedNotes();
        }
    }

    async getNote(id: string, shareToken?: string): Promise<Note | null> {
        try {
            const params = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";
            const res = await this.request(`/api/notes/${id}${params}`);
            if (res.status === 404) return null;
            await assertOk(res, "Failed to fetch note");
            return res.json();
        } catch {
            const cached = await getCachedNotes();
            return cached.find((n) => n.id === id) ?? null;
        }
    }

    async getNoteMeta(id: string, shareToken?: string): Promise<Partial<Note> | null> {
        try {
            const params = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";
            const res = await this.request(`/api/notes/${id}/meta${params}`);
            if (res.status === 404) return null;
            if (!res.ok) return null;
            return res.json();
        } catch {
            return null;
        }
    }

    async saveNote(id: string, title: string, content: string, folderId?: string | null): Promise<SaveResult> {
        const body: Record<string, any> = { id, title, content };
        if (folderId !== undefined) body.folder_id = folderId;
        const res = await this.request("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        await assertOk(res, "Failed to save note");
        return { ok: true, note: await res.json() };
    }

    async flushNote(): Promise<SaveResult> {
        return { ok: true };
    }

    async deleteNote(id: string): Promise<void> {
        const res = await this.request(`/api/notes/${id}`, { method: "DELETE" });
        await assertOk(res, "Failed to delete note");
    }

    async getTrash(): Promise<Note[]> {
        const res = await this.request("/api/notes-trash");
        await assertOk(res, "Failed to fetch trash");
        return res.json();
    }

    async restoreNote(id: string): Promise<Note | null> {
        const res = await this.request(`/api/notes/${id}/restore`, { method: "POST" });
        await assertOk(res, "Failed to restore note");
        return res.json();
    }

    async permanentlyDeleteNote(id: string): Promise<void> {
        const res = await this.request(`/api/notes/${id}/permanent`, { method: "DELETE" });
        await assertOk(res, "Failed to permanently delete note");
    }

    async getCachedFolders(): Promise<Folder[]> {
        return getCachedFolders();
    }

    async getFolders(): Promise<Folder[]> {
        try {
            const res = await this.request("/api/folders");
            await assertOk(res, "Failed to fetch folders");
            const folders: Folder[] = await res.json();
            setCachedFolders(folders);
            return folders;
        } catch {
            return getCachedFolders();
        }
    }

    async saveFolder(folder: Partial<Folder> & { id: string; name: string }): Promise<void> {
        const res = await this.request("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(folder),
        });
        await assertOk(res, "Failed to save folder");
    }

    async deleteFolder(id: string): Promise<void> {
        const res = await this.request(`/api/folders/${id}`, { method: "DELETE" });
        await assertOk(res, "Failed to delete folder");
    }

    async moveNoteToFolder(noteId: string, folderId: string | null): Promise<void> {
        const res = await this.request(`/api/notes/${noteId}/folder`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder_id: folderId }),
        });
        await assertOk(res, "Failed to move note");
    }

    async setNoteSyncMode(noteId: string, mode: "cloud" | "local"): Promise<void> {
        const res = await this.request(`/api/notes/${noteId}/sync-mode`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sync_mode: mode }),
        });
        await assertOk(res, "Failed to set sync mode");
    }

    // Sharing
    async createShare(noteId: string, opts: { email?: string; permission?: string }): Promise<{ id: string; shareToken: string }> {
        const res = await this.request("/api/shares", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteId, ...opts }),
        });
        await assertOk(res, "Failed to create share");
        return res.json();
    }

    async listShares(noteId: string): Promise<Share[]> {
        const res = await this.request(`/api/shares?noteId=${encodeURIComponent(noteId)}`);
        await assertOk(res, "Failed to list shares");
        return res.json();
    }

    async deleteShare(id: string): Promise<void> {
        const res = await this.request(`/api/shares/${id}`, { method: "DELETE" });
        await assertOk(res, "Failed to delete share");
    }

    async getSharedWithMe(): Promise<SharedNote[]> {
        const res = await this.request("/api/shared-with-me");
        if (!res.ok) return [];
        return res.json();
    }

    // Locking
    async lockNote(noteId: string): Promise<void> {
        const res = await this.request(`/api/notes/${noteId}/lock`, { method: "POST" });
        await assertOk(res, "Failed to lock note");
    }

    async unlockNote(noteId: string, lockToken: string): Promise<void> {
        const res = await this.request(`/api/notes/${noteId}/unlock`, {
            method: "POST",
            headers: { "X-Lock-Token": lockToken },
        });
        await assertOk(res, "Failed to unlock note");
    }

    async verifyLock(noteId: string): Promise<{ lockToken: string }> {
        // Step 1: Trigger passkey authentication via Better Auth
        await authClient.signIn.passkey();

        // Step 2: Exchange for lock token
        const res = await this.request(`/api/notes/${noteId}/verify-lock/complete`, {
            method: "POST",
        });
        await assertOk(res, "Failed to verify lock");
        return res.json();
    }

    // History (git-style versioning — server reconstructs content from patches)
    async getNoteHistory(noteId: string): Promise<NoteVersion[]> {
        const res = await this.request(`/api/notes/${noteId}/history`);
        await assertOk(res, "Failed to fetch note history");
        return res.json();
    }

    async getVersion(noteId: string, versionId: string): Promise<NoteVersion | null> {
        const res = await this.request(`/api/notes/${noteId}/history/${versionId}`);
        if (res.status === 404) return null;
        await assertOk(res, "Failed to fetch version");
        return res.json();
    }

    async restoreVersion(noteId: string, versionId: string): Promise<Note | null> {
        const res = await this.request(`/api/notes/${noteId}/history/restore`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version_id: versionId }),
        });
        await assertOk(res, "Failed to restore version");
        return res.json();
    }

    async beginEditSession(noteId: string): Promise<SessionHandle> {
        const res = await this.request(`/api/notes/${noteId}/sessions`, { method: "POST" });
        await assertOk(res, "Failed to begin edit session");
        return res.json();
    }

    async finalizeEditSession(noteId: string, sessionId: string, reason: string): Promise<{ versionId?: string }> {
        const res = await this.request(`/api/notes/${noteId}/sessions/${sessionId}/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
        });
        await assertOk(res, "Failed to finalize edit session");
        return res.json();
    }

    async scheduleMemorySync(noteId: string): Promise<void> {
        const res = await this.request(`/api/notes/${noteId}/memory-sync`, { method: "POST" });
        await assertOk(res, "Failed to sync note to memory");
    }

    // Branches
    async getBranches(noteId: string): Promise<NoteBranch[]> {
        const res = await this.request(`/api/notes/${noteId}/branches`);
        await assertOk(res, "Failed to fetch branches");
        return res.json();
    }

    async createBranch(noteId: string, name: string): Promise<NoteBranch> {
        const res = await this.request(`/api/notes/${noteId}/branches`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        await assertOk(res, "Failed to create branch");
        return res.json();
    }

    async checkoutBranch(noteId: string, branchId: string): Promise<{ branch: string; content: string }> {
        const res = await this.request(`/api/notes/${noteId}/branches/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ branch_id: branchId }),
        });
        await assertOk(res, "Failed to checkout branch");
        return res.json();
    }

    async deleteBranch(noteId: string, branchId: string): Promise<void> {
        const res = await this.request(`/api/notes/${noteId}/branches/${branchId}`, { method: "DELETE" });
        await assertOk(res, "Failed to delete branch");
    }

    async mergeBranch(noteId: string, sourceBranchId: string): Promise<{ ok: boolean; source_branch: string }> {
        const res = await this.request(`/api/notes/${noteId}/branches/merge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source_branch_id: sourceBranchId }),
        });
        await assertOk(res, "Failed to merge branch");
        return res.json();
    }

    async getNoteTree(noteId: string): Promise<NoteTree> {
        const res = await this.request(`/api/notes/${noteId}/tree`);
        await assertOk(res, "Failed to fetch tree");
        return res.json();
    }

    // Media
    async getMedia(): Promise<MediaItem[]> {
        const res = await this.request("/api/media");
        await assertOk(res, "Failed to fetch media");
        return res.json();
    }

    async uploadMedia(file: File, dimensions?: { width: number; height: number }): Promise<MediaItem> {
        const form = new FormData();
        form.append("file", file);
        if (dimensions) {
            form.append("width", String(dimensions.width));
            form.append("height", String(dimensions.height));
        }
        const res = await this.request("/api/media", { method: "POST", body: form });
        await assertOk(res, "Failed to upload media");
        return res.json();
    }

    async deleteMedia(id: string): Promise<void> {
        const res = await this.request(`/api/media/${id}`, { method: "DELETE" });
        await assertOk(res, "Failed to delete media");
    }

    async publishMedia(id: string, published: boolean): Promise<void> {
        const res = await this.request(`/api/media/${id}/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ published }),
        });
        await assertOk(res, "Failed to publish media");
    }

    async updateMediaCaption(id: string, caption: string): Promise<void> {
        const res = await this.request(`/api/media/${id}/caption`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caption }),
        });
        await assertOk(res, "Failed to update caption");
    }

    /**
     * Auth suffix for media URLs. `<img src>` can't send an `X-Session-Token`
     * header, so token-based clients return `?token=...` (the server also
     * accepts the session via query param). Web returns "" and relies on the
     * same-origin cookie.
     */
    protected mediaQuery(): string {
        return "";
    }

    getMediaUrl(id: string): string {
        return `${this.apiBase}/api/media/${id}/file${this.mediaQuery()}`;
    }

    // Publishing
    async publishNote(noteId: string, published: boolean): Promise<void> {
        const res = await this.request(`/api/notes/${noteId}/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ published }),
        });
        await assertOk(res, "Failed to publish note");
    }

    // Profile
    async getProfile(): Promise<Profile> {
        const res = await this.request("/api/profile");
        return res.json();
    }

    async updateProfile(data: Partial<Profile>): Promise<void> {
        const res = await this.request("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        await assertOk(res, "Failed to update profile");
    }

    createProvider(noteId: string, doc: Y.Doc, opts?: { shareToken?: string; onContentReset?: () => void }): NottyProvider {
        return new NottyProvider(noteId, doc, { connect: false, shareToken: opts?.shareToken, onContentReset: opts?.onContentReset });
    }

    /**
     * WS query string carrying auth. Web relies on the same-origin cookie sent
     * with the handshake, so it needs nothing. Token-based clients (mobile)
     * override this to append `&token=...` since a WebSocket handshake can't set
     * an `X-Session-Token` header and the `tauri://localhost` origin has no cookie.
     */
    protected async wsAuthQuery(): Promise<string> {
        return "";
    }

    subscribeToNoteEvents(handler: (evt: NoteEvent) => void): () => void {
        let ws: WebSocket | null = null;
        let closed = false;
        let reconnectDelay = 1000;
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        const connect = async () => {
            if (closed) return;
            let authQuery = "";
            try { authQuery = await this.wsAuthQuery(); } catch {}
            if (closed) return;
            // Derive the ws origin AFTER auth resolves — mobile's apiBase can be
            // set while loading the token. Empty apiBase = same-origin web.
            const wsBase = this.apiBase
                ? this.apiBase.replace(/^http/, "ws")
                : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
            const url = `${wsBase}/api/sync?noteId=__events__${authQuery}`;

            let sock: WebSocket;
            try { sock = new WebSocket(url); } catch { scheduleReconnect(); return; }
            ws = sock;
            sock.onopen = () => { reconnectDelay = 1000; };
            sock.onmessage = (event) => {
                // Only string control frames (broadcastJson) matter here. The DO
                // also sends a binary yjs syncStep1 on connect — ignore it.
                if (typeof event.data !== "string") return;
                let msg: any;
                try { msg = JSON.parse(event.data); } catch { return; }
                if (msg && typeof msg.type === "string") handler(msg as NoteEvent);
            };
            sock.onclose = () => { ws = null; if (!closed) scheduleReconnect(); };
            sock.onerror = () => { try { sock.close(); } catch {} };
        };

        const scheduleReconnect = () => {
            if (closed) return;
            reconnectDelay = Math.min(reconnectDelay * 2, 30000);
            reconnectTimer = setTimeout(connect, reconnectDelay);
        };

        connect();

        return () => {
            closed = true;
            clearTimeout(reconnectTimer);
            try { ws?.close(); } catch {}
            ws = null;
        };
    }
}
