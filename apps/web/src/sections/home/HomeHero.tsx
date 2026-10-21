"use client";

import { Button } from "@/design-system";
import type { HeroMedia } from "@/lib/hero-media";
import { Parallax, Reveal, ScrollCue } from "@/motion";
import { heroOffset } from "../shared/Section";
import { HeroFilm } from "./HeroFilm";

/* Where Taktshang sits in the photograph. The picture is 4:3 and the frame is
   a full viewport, so on any screen wider than 4:3 `cover` throws away the top
   and bottom — centred, that took the monastery's roofline with it, and the
   1.14 overscan and the navigation laid over the top took more. Anchoring both
   the crop and the scale to the top edge keeps the building whole; what is
   lost is the foot of the cliff. */
const FOCUS = "50% 0%";

/**
 * The home hero. Parallax at speed .6 with the 24s `mist` drift layered on top
 * of the transform. One headline — the strapline from the panel, in the hero
 * face — and one button, centred beneath the monastery so the words never sit
 * over the thing the photograph is of.
 *
 * What is behind the words is the photograph, a film on this origin, or a film
 * on YouTube, as `lib/hero-media.ts` says. Whichever it is, the picture is what
 * loads first and what is still there if a film never plays: `HeroFilm` lies
 * over this `Parallax` inside its clipped frame and covers it once it has
 * frames, so the hero's largest paint is the same photograph in all three cases
 * — see the note on `HeroFilm`.
 */
export function HomeHero({
    media,
    alt,
    line,
}: {
    media: HeroMedia;
    /**
     * The photograph's description, read on the server. A client component
     * cannot look an alt up — the registry is module scope and resolves to ""
     * here, which is how that was found — so it travels as a prop.
     */
    alt?: string;
    line: string;
}) {
    /* Under a film the picture is the film's first frame, which describes
       nothing the headline does not; the photograph keeps its description
       because under a film it is what a reader who declined the motion is
       actually looking at. */
    const still = media.kind === "image" ? media.image : media.still ?? media.image;
    const stillAlt = still === media.image ? alt : "";

    return (
        <Parallax
            src={still}
            alt={stillAlt}
            speed={0.6}
            priority
            imgStyle={{
                objectPosition: FOCUS,
                transformOrigin: FOCUS,
                animation:
                    "mist var(--dur-mist) var(--ease-drift) infinite alternate",
            }}
            style={{
                height: "100svh",
                minHeight: 640,
                display: "flex",
                alignItems: "flex-end",
                ...heroOffset,
            }}
        >
            {/* The film, where there is one: over the picture, under the scrim,
          and nothing at all when the hero is a photograph. */}
            <HeroFilm media={media} focus={FOCUS} />
            {/* Only the lower half darkens, for the words. The upper half is the
          monastery and the sky, and is left as the photograph has it. */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "linear-gradient(to top,rgba(31,29,26,.72),rgba(31,29,26,.28) 40%,rgba(31,29,26,0) 62%)",
                }}
            />
            {/* The words and the button stand centred beneath the monastery;
                the scroll cue stands beside them, level with their foot,
                rather than stacked underneath — the outer columns are equal so
                the words stay on the picture's centre line. */}
            <div
                className="lp-hero-row"
                style={{
                    position: "relative",
                    padding: "0 var(--gutter) var(--space-6)",
                    width: "100%",
                    color: "var(--paper)",
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
                    alignItems: "end",
                    gap: "var(--space-6)",
                }}
            >
                <div
                    style={{
                        gridColumn: 2,
                        display: "grid",
                        justifyItems: "center",
                        textAlign: "center",
                        gap: "var(--space-6)",
                    }}
                >
                    <Reveal>
                        <h1
                            style={{
                                fontFamily: "var(--font-hero)",
                                fontSize: "var(--text-h1)",
                                fontWeight: "var(--weight-body)",
                                lineHeight: "var(--leading-heading)",
                                letterSpacing: "var(--tracking-display)",
                                maxWidth: "var(--measure-narrow)",
                                margin: "0 auto",
                            }}
                        >
                            {line}
                        </h1>
                    </Reveal>
                    <Reveal delay={240}>
                        <Button variant="inverse" size="lg" href="/trips">
                            Explore trips
                        </Button>
                    </Reveal>
                </div>
                <div className="lp-hero-cue" style={{ justifySelf: "start" }}>
                    <ScrollCue />
                </div>
            </div>
        </Parallax>
    );
}
