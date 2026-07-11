import { createImageUpload } from "novel";
import { toast } from "sonner";
import { getActiveAdapter } from "@/context/adapter-context";

const MAX_SIZE_MB = 50;

// Read the natural pixel dimensions of an image file so the server can
// persist them (used for layout hints + the resize handles).
function getImageDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(undefined);
        };
        img.src = url;
    });
}

// Upload an image file to R2 via the media API and resolve to the URL the
// editor should reference. The same path is used by paste, drop, and the
// "/image" slash command. We hit /api/media directly (rather than the adapter)
// so this can run from the static extensions module without React context.
export const uploadFn = createImageUpload({
    validateFn: (file) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Only image files can be inserted here.");
            return false;
        }
        if (file.size / 1024 / 1024 > MAX_SIZE_MB) {
            toast.error(`Image is too large (max ${MAX_SIZE_MB}MB).`);
            return false;
        }
        return true;
    },
    onUpload: async (file) => {
        const dimensions = await getImageDimensions(file);

        // Route through the active adapter so the request hits the correct origin
        // with the correct auth. On mobile the webview origin is NOT notty.page and
        // auth is an `X-Session-Token` header — a raw same-origin `fetch("/api/media")`
        // there resolves to the wrong place and WebKit throws "the string did not
        // match the expected pattern". The adapter also builds the display URL with
        // the right base + media auth query, so images render on mobile too.
        const adapter = getActiveAdapter();

        const promise = (async () => {
            let mediaId: string;
            let src: string;
            if (adapter) {
                const media = await adapter.uploadMedia(file, dimensions);
                mediaId = media.id;
                src = adapter.getMediaUrl(mediaId);
            } else {
                const form = new FormData();
                form.append("file", file);
                if (dimensions) {
                    form.append("width", String(dimensions.width));
                    form.append("height", String(dimensions.height));
                }
                const res = await fetch("/api/media", { method: "POST", body: form });
                if (!res.ok) throw new Error(await res.text().catch(() => "Upload failed"));
                mediaId = ((await res.json()) as { id: string }).id;
                src = `/api/media/${mediaId}/file`;
            }
            // Preload so the swap from placeholder → image is instant and
            // novel can measure the loaded element.
            return new Promise<string>((resolve) => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(src);
                img.onerror = () => resolve(src);
            });
        })();

        toast.promise(promise, {
            loading: "Uploading image…",
            success: "Image uploaded",
            error: (e) => (e instanceof Error ? e.message : "Failed to upload image"),
        });

        return await promise;
    },
});
