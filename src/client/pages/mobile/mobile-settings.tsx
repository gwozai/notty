import { useState } from "react";
import { Moon, Sun, LogOut, Globe, ChevronRight, Trash2, UserX, Shield } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useAdapter } from "@/context/adapter-context";
import { useNotes } from "@/context/notes-context";
import { MobileShell, MobileHeader } from "@/components/mobile/mobile-shell";
import { toggleDarkMode, useIsDark } from "@/lib/dark-mode";

export function MobileSettingsPage() {
    const { user, signOut } = useAuth();
    const adapter = useAdapter();
    const { trash } = useNotes();
    const dark = useIsDark();
    const navigate = useNavigate();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await adapter.deleteAccount();
            await signOut().catch(() => {});
            window.location.reload();
        } catch (e: any) {
            toast.error(e?.message || "Couldn't delete your account.");
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    return (
        <MobileShell>
            <MobileHeader title="Settings" />

            <div className="px-4 pt-4 space-y-6">
                {/* Account */}
                <section>
                    <SectionLabel>Account</SectionLabel>
                    <Card>
                        <div className="flex items-center gap-3 px-4 py-3.5">
                            <div className="h-11 w-11 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center font-serif text-lg">
                                {(user?.name || user?.email || "N").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[15px] font-medium text-[var(--color-ink)] truncate">
                                    {user?.name || "Notty user"}
                                </p>
                                {user?.email && (
                                    <p className="text-[13px] text-[var(--color-ink-muted)] truncate">{user.email}</p>
                                )}
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Appearance */}
                <section>
                    <SectionLabel>Appearance</SectionLabel>
                    <Card>
                        <Row
                            icon={dark ? <Moon size={18} /> : <Sun size={18} />}
                            label="Dark mode"
                            onClick={toggleDarkMode}
                            right={
                                <span
                                    className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                                        dark ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-warm)]"
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                            dark ? "translate-x-4" : "translate-x-0.5"
                                        }`}
                                    />
                                </span>
                            }
                        />
                    </Card>
                </section>

                {/* Notes */}
                <section>
                    <SectionLabel>Notes</SectionLabel>
                    <Card>
                        <Row
                            icon={<Trash2 size={18} />}
                            label="Trash"
                            onClick={() => navigate("/m/trash")}
                            right={
                                <span className="flex items-center gap-1.5">
                                    {trash.length > 0 && (
                                        <span className="text-[13px] text-[var(--color-ink-muted)]">{trash.length}</span>
                                    )}
                                    <ChevronRight size={16} className="text-[var(--color-ink-muted)]/50" />
                                </span>
                            }
                        />
                    </Card>
                </section>

                {/* Links */}
                <section>
                    <SectionLabel>Your page</SectionLabel>
                    <Card>
                        <Row
                            icon={<Globe size={18} />}
                            label="Open notty.page"
                            onClick={() => openExternal("https://notty.page")}
                            right={<ChevronRight size={16} className="text-[var(--color-ink-muted)]/50" />}
                        />
                        <Row
                            icon={<Shield size={18} />}
                            label="Privacy Policy"
                            onClick={() => openExternal("https://notty.page/privacy")}
                            right={<ChevronRight size={16} className="text-[var(--color-ink-muted)]/50" />}
                        />
                    </Card>
                </section>

                {/* Sign out + delete */}
                <section>
                    <Card>
                        <Row
                            icon={<LogOut size={18} className="text-red-500" />}
                            label={<span className="text-red-500">Sign out</span>}
                            onClick={signOut}
                        />
                        <Row
                            icon={<UserX size={18} className="text-red-500" />}
                            label={<span className="text-red-500">Delete account</span>}
                            onClick={() => setConfirmDelete(true)}
                        />
                    </Card>
                </section>

                <p className="text-center text-[11px] font-mono text-[var(--color-ink-muted)]/60 pt-2">Notty · v0.1.0</p>
            </div>

            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
                     onClick={() => !deleting && setConfirmDelete(false)}>
                    <div className="w-full max-w-sm rounded-2xl bg-[var(--color-card)] border border-[var(--color-border-warm)] p-5 space-y-4"
                         onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1.5">
                            <p className="font-serif text-lg text-[var(--color-ink)]">Delete account?</p>
                            <p className="text-[13px] text-[var(--color-ink-muted)]">
                                This permanently deletes your account and all of your notes, images, and folders. This cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDelete(false)}
                                disabled={deleting}
                                className="flex-1 py-2.5 rounded-xl text-[15px] font-medium bg-[var(--color-sidebar-active)] text-[var(--color-ink)] active:scale-[0.98] transition-transform disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                className="flex-1 py-2.5 rounded-xl text-[15px] font-medium bg-red-500 text-white active:scale-[0.98] transition-transform disabled:opacity-60"
                            >
                                {deleting ? "Deleting…" : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MobileShell>
    );
}

async function openExternal(url: string) {
    try {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(url);
    } catch {
        window.open(url, "_blank");
    }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="px-1 pb-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]/70">
            {children}
        </p>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-2xl bg-[var(--color-card)] border border-[var(--color-border-warm)] overflow-hidden divide-y divide-[var(--color-border-warm)]/60">
            {children}
        </div>
    );
}

function Row({
    icon,
    label,
    onClick,
    right,
}: {
    icon: React.ReactNode;
    label: React.ReactNode;
    onClick?: () => void;
    right?: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[var(--color-sidebar-active)]/50 transition-colors"
        >
            <span className="text-[var(--color-ink-muted)]">{icon}</span>
            <span className="flex-1 text-[15px] text-[var(--color-ink)]">{label}</span>
            {right}
        </button>
    );
}
