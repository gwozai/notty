import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * iOS-style "swipe from the left edge to go back". Tauri's WKWebView ships with
 * `allowsBackForwardNavigationGestures` off, so the native interactive-pop never
 * fires; we reproduce it in JS and drive React Router history directly. Mount
 * this once at the mobile shell level.
 *
 * Only gestures that start within ~24px of the left edge and travel mostly
 * horizontally count, so it never fights vertical scrolling or mid-screen drags.
 */
export function useEdgeSwipeBack() {
    const navigate = useNavigate();
    useEffect(() => {
        let startX = 0;
        let startY = 0;
        let tracking = false;

        const onStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) {
                tracking = false;
                return;
            }
            const t = e.touches[0];
            tracking = t.clientX <= 24;
            startX = t.clientX;
            startY = t.clientY;
        };
        const onEnd = (e: TouchEvent) => {
            if (!tracking) return;
            tracking = false;
            const t = e.changedTouches[0];
            const dx = t.clientX - startX;
            const dy = Math.abs(t.clientY - startY);
            // Mostly-horizontal fling from the edge → pop history.
            if (dx > 70 && dy < 50) {
                if (window.history.length > 1) navigate(-1);
                else navigate("/m");
            }
        };

        window.addEventListener("touchstart", onStart, { passive: true });
        window.addEventListener("touchend", onEnd, { passive: true });
        return () => {
            window.removeEventListener("touchstart", onStart);
            window.removeEventListener("touchend", onEnd);
        };
    }, [navigate]);
}
