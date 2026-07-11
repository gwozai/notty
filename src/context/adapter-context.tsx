import { createContext, useContext, type ReactNode } from "react";
import type { NottyAdapter } from "@/lib/adapter";

const AdapterContext = createContext<NottyAdapter | null>(null);

// Module-level handle on the active adapter, for the few non-React modules that
// need it (e.g. the editor's static image-upload extension, which runs outside
// any component and must still hit the right origin with the right auth header).
let activeAdapter: NottyAdapter | null = null;
export function getActiveAdapter(): NottyAdapter | null {
    return activeAdapter;
}

export function AdapterProvider({ adapter, children }: { adapter: NottyAdapter; children: ReactNode }) {
    activeAdapter = adapter;
    return (
        <AdapterContext.Provider value={adapter}>
            {children}
        </AdapterContext.Provider>
    );
}

export function useAdapter(): NottyAdapter {
    const ctx = useContext(AdapterContext);
    if (!ctx) throw new Error("useAdapter must be used within AdapterProvider");
    return ctx;
}
