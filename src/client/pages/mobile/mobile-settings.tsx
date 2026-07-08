import { Moon, Sun, LogOut, Globe, ChevronRight, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/context/auth-context";
import { useNotes } from "@/context/notes-context";
import { MobileShell, MobileHeader } from "@/components/mobile/mobile-shell";
import { toggleDarkMode, useIsDark } from "@/lib/dark-mode";

export function MobileSettingsPage() {
    const { user, signOut } = useAuth();
    const { trash } = useNotes();
    const dark = useIsDark();
    const navigate = useNavigate();

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
                    </Card>
                </section>

                {/* Sign out */}
                <section>
                    <Card>
                        <Row
                            icon={<LogOut size={18} className="text-red-500" />}
                            label={<span className="text-red-500">Sign out</span>}
                            onClick={signOut}
                        />
                    </Card>
                </section>

                <p className="text-center text-[11px] font-mono text-[var(--color-ink-muted)]/60 pt-2">Notty · v0.1.0</p>
            </div>
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
