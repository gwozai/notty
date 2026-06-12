import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { AdapterProvider } from "@/context/adapter-context";
import { AuthProvider } from "@/context/auth-context";
import { NotesProvider } from "@/context/notes-context";
import { FoldersProvider } from "@/context/folders-context";
import { MediaProvider } from "@/context/media-context";
import { TabsProvider } from "@/context/tabs-context";
import type { NottyAdapter } from "@/lib/adapter";
import { WebAdapter } from "@/lib/web-adapter";
import { HomePage } from "./pages/home";
import { AuthPasskeyPage } from "./pages/auth-passkey";
import { SharedResolvePage } from "./pages/shared-resolve";
import { PublicSettingsPage } from "./pages/public-settings";
import { Toaster } from "sonner";
import "@/styles/globals.css";

const NotePage = lazy(() => import("./pages/note").then((m) => ({ default: m.NotePage })));
const TrashPage = lazy(() => import("./pages/trash").then((m) => ({ default: m.TrashPage })));
const QuickNotePage = lazy(() => import("./pages/quick-note").then((m) => ({ default: m.QuickNotePage })));

const isTauri = "__TAURI_INTERNALS__" in window;

function PageFallback() {
    return null;
}

async function getDesktopAdapter(): Promise<NottyAdapter> {
    const { DesktopAdapter } = await import("@/lib/desktop-adapter");
    const adapter = new DesktopAdapter();
    import("@tauri-apps/api/core")
        .then(({ invoke }) => invoke("sync_from_markdown"))
        .catch((e) => console.warn("[notty] Markdown startup sync failed:", e));
    return adapter;
}

function renderApp(adapter: NottyAdapter) {
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <BrowserRouter>
                <AdapterProvider adapter={adapter}>
                    <AuthProvider>
                        <NotesProvider>
                            <FoldersProvider>
                                <MediaProvider>
                                    <TabsProvider>
                                        <Routes>
                                            <Route path="/" element={<HomePage />} />
                                            <Route path="/trash" element={<Suspense fallback={<PageFallback />}><TrashPage /></Suspense>} />
                                            <Route path="/note/:id" element={<Suspense fallback={<PageFallback />}><NotePage /></Suspense>} />
                                            <Route path="/auth/passkey" element={<AuthPasskeyPage />} />
                                            <Route path="/shared/:token" element={<SharedResolvePage />} />
                                            <Route path="/settings/public" element={<PublicSettingsPage />} />
                                            <Route path="/quick-note" element={<Suspense fallback={<PageFallback />}><QuickNotePage /></Suspense>} />
                                        </Routes>
                                    </TabsProvider>
                                </MediaProvider>
                            </FoldersProvider>
                        </NotesProvider>
                    </AuthProvider>
                </AdapterProvider>
            </BrowserRouter>
            <Toaster position="bottom-center" toastOptions={{
                style: {
                    fontFamily: "inherit",
                    background: "var(--color-card)",
                    color: "var(--color-ink)",
                    border: "1px solid var(--color-border-warm)",
                },
            }} />
        </StrictMode>
    );
}

if (isTauri) {
    getDesktopAdapter().then(renderApp);
} else {
    renderApp(new WebAdapter());
}
