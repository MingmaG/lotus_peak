"use client";

import { useEffect } from "react";
import { EMBED_ALLOW, embedUrl, parseVideoSource } from "@lotuspeak/video";

import { warmVideoConnections } from "@/lib/video-warm";

/**
 * Makes the film façades inside a body of rich text play.
 *
 * A film inside a journal entry cannot be a React component:
 * the body is one sanitised HTML string that `Prose` sets as inner HTML, so
 * there is no element for React to own. `lib/rich-text.ts` writes the
 * façade markup into that string, and this puts one listener on the document
 * to answer it.
 *
 * **Why a delegated listener and not a component per film.** React does not
 * manage anything under `dangerouslySetInnerHTML`, so replacing a node in
 * there is safe — it will never be reconciled away. Doing the same to markup
 * React *does* own would be a bug waiting for the next re-render, which is why
 * this only ever touches `[data-video-facade]`, an attribute nothing in JSX
 * writes.
 *
 * Mounted by `Prose`, and only for a body that actually contains one, so a
 * page with no films in its prose ships none of this.
 */
export function VideoFacadeScript() {
  useEffect(() => {
    const facadeOf = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element
        ? target.closest<HTMLElement>("[data-video-facade]")
        : null;

    const warm = (event: Event) => {
      const facade = facadeOf(event.target);
      if (facade) warmVideoConnections(parseVideoSource(facade.dataset.videoSrc));
    };

    const play = (event: MouseEvent) => {
      // A modified click is the visitor asking for the film on its own site;
      // the façade is a real link and it should behave like one.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;

      const facade = facadeOf(event.target);
      if (!facade || facade.dataset.videoPlaying === "true") return;

      const source = parseVideoSource(facade.dataset.videoSrc);
      const src = embedUrl(source);
      if (!src) return;

      event.preventDefault();

      const frame = document.createElement("iframe");
      frame.className = "video-facade-player";
      frame.src = src;
      frame.title = facade.dataset.videoTitle || "Video";
      frame.allow = EMBED_ALLOW;
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";

      facade.dataset.videoPlaying = "true";
      facade.replaceChildren(frame);
      frame.focus();
    };

    document.addEventListener("click", play);
    // `pointerenter` does not bubble; `pointerover` is its delegating twin.
    document.addEventListener("pointerover", warm, { passive: true });
    document.addEventListener("focusin", warm, { passive: true });

    return () => {
      document.removeEventListener("click", play);
      document.removeEventListener("pointerover", warm);
      document.removeEventListener("focusin", warm);
    };
  }, []);

  return null;
}
