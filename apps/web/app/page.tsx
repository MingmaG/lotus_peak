import { Button, Divider, Eyebrow, Reflection, SiteIcon, TrekCard } from '@/design-system'
import { getContent } from '@/content'
import { HOME_PURPOSES as PURPOSES } from '@/content/data/pages'
import { fmt } from '@/content/types'
import { IMG, altFor } from '@/lib/assets'
import { Reveal, Split, Strip } from '@/motion'
import { HomeHero } from '@/sections/home/HomeHero'
import { Seasons } from '@/sections/home/Seasons'
import { BandInquiry, BandLink } from '@/sections/shared/BandCta'
import { Section } from '@/sections/shared/Section'

export default async function HomePage() {
  const content = getContent()
  const [trips, destinations, seasons, reflections, settings] = await Promise.all([
    content.trips.list({ limit: 4 }),
    content.destinations.list(),
    content.seasons.list(),
    content.reflections.list({ featured: true, limit: 2 }),
    content.settings.get(),
  ])

  return (
    <main>
      <HomeHero image={IMG.dzong} alt={altFor(IMG.dzong)} />

      {/* 01 — Our purpose */}
      <section style={{ position: 'relative', padding: 'var(--space-11) var(--gutter) var(--space-10)' }}>
        <div
          className="lp-two-col"
          style={{
            position: 'relative',
            maxWidth: 'var(--container)',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)',
            gap: 'var(--space-9)',
            alignItems: 'start',
          }}
        >
          <Reveal>
            <Eyebrow number="01">Our purpose</Eyebrow>
            <h2 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '14ch' }}>
              Mindful journeys in Bhutan
            </h2>
          </Reveal>
          <div>
            <Reveal delay={300}>
              <p style={{ fontSize: 'var(--text-lead)', lineHeight: 'var(--leading-lead)' }}>
                We are a small Bhutanese company. We share the practice of awareness in a country where it still
                shapes daily life.
              </p>
            </Reveal>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                gap: 'var(--space-7)',
                marginTop: 'var(--space-8)',
              }}
            >
              {PURPOSES.map(([t, b], i) => (
                <Reveal key={t} delay={250 + i * 120}>
                  <Divider variant="gold" />
                  <h3 style={{ fontSize: 'var(--text-h3)', marginTop: 24 }}>{t}</h3>
                  <p style={{ marginTop: 14, color: 'var(--text-muted)' }}>{b}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 02 — Our trips */}
      <Section num="02" eyebrow="Our trips" title="Four journeys, each with time to spare" style={{ paddingTop: 0 }}>
        <div
          className="lp-trip-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
            gap: 'var(--space-6)',
            marginTop: 'var(--space-8)',
          }}
        >
          {trips.map((t, i) => (
            <Reveal key={t.slug} delay={i * 220} y={40}>
              <TrekCard
                href={`/trips/${t.slug}`}
                image={t.heroImage}
                imageAlt={t.heroAlt}
                region={fmt.regionsShort(t)}
                title={t.title}
                days={fmt.duration(t)}
                altitude={fmt.altitude(t)}
                difficulty={t.difficulty}
                price={fmt.price(t)}
                sizes="(max-width: 900px) 100vw, 23vw"
              />
            </Reveal>
          ))}
        </div>
        <Reveal delay={400}>
          <div style={{ marginTop: 'var(--space-8)' }}>
            <Button variant="ghost" href="/trips">
              All trips →
            </Button>
          </div>
        </Reveal>
      </Section>

      <BandLink
        href="/culture"
        src={IMG.taktshang}
        eyebrow="The last Himalayan kingdom"
        title="A culture that is still in use"
        body="The dzongs, temples and festivals are not exhibits. Monks chant in them at dawn, farmers pass through them on the way to market, and the whole valley turns out for the tshechu."
        cta="Culture & traditions"
      />

      {/* 03 — Destinations */}
      <Section
        id="destinations"
        ground
        motif="friends"
        motifSide="right"
        motifSize="min(640px,40%)"
        num="03"
        eyebrow="Destinations"
        title="Where we go"
        lead="Six valleys, each with its own dzong and its own pace."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
            gap: 'var(--space-6) var(--space-8)',
            marginTop: 'var(--space-9)',
            borderTop: '1px solid rgba(247,243,236,.15)',
          }}
        >
          {destinations.map((d, i) => (
            <Reveal
              key={d.slug}
              delay={i * 180}
              style={{
                paddingTop: 32,
                display: 'grid',
                gridTemplateColumns: '136px 1fr',
                gap: 20,
                alignItems: 'start',
              }}
            >
              <SiteIcon name={d.icon} size={88} framed color="var(--saffron-2)" ring="rgba(185,151,91,.55)" />
              <div>
                <h3 style={{ fontSize: 'var(--text-h3)' }}>{d.name}</h3>
                <p style={{ marginTop: 8, color: 'rgba(247,243,236,.7)', fontSize: 'var(--text-small)' }}>
                  {d.blurb}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 04 — Living tradition */}
      <Split
        src={IMG.tashichho}
        ratio="3/2"
        columns="minmax(0,1.35fr) minmax(0,1fr)"
        caption="Tashichho Dzong, Thimphu"
        num="04"
        eyebrow="Living tradition"
        title="Arts, crafts and Jomzo"
      >
        <p style={{ fontSize: 'var(--text-lead)', lineHeight: 'var(--leading-lead)', color: 'var(--ink)' }}>
          Jomzo is the Bhutanese art of shaping clay, copper and gold into sacred statues, finished with unusual
          precision. We arrange time with artisans at work, in workshops and living exhibitions, so you meet the
          culture as a participant rather than an onlooker.
        </p>
        <p>
          Festival journeys are timed to a tshechu: masked dances in a dzong courtyard, the whole valley in its
          finest kira and gho.
        </p>
      </Split>

      <Strip
        /* The fourth element is the description. These five are design
           assets that still live in public/, so it resolves on the server
           here — a client component could not look it up. */
        images={[
          [IMG.chorten, '4/5', '26vw', altFor(IMG.chorten)],
          [IMG.bridge, '3/2', '44vw', altFor(IMG.bridge)],
          [IMG.dress, '4/5', '26vw', altFor(IMG.dress)],
          [IMG.tashichho, '3/2', '44vw', altFor(IMG.tashichho)],
          [IMG.hike, '4/5', '26vw', altFor(IMG.hike)],
        ]}
        caption="Memorial Chorten, Punakha, a kira at the festival, Tashichho Dzong, the trail below Jomolhari."
      />

      {/* 05 — When to come */}
      <Section
        id="seasons"
        num="05"
        eyebrow="When to come"
        title="Each season keeps its own appointments"
        lead="Other than the deep monsoon weeks, there is no wrong time. Spring and autumn for clear skies and festivals, winter for the cranes, summer for green and quiet."
        style={{ background: 'var(--surface-sunken)' }}
      >
        <Seasons seasons={seasons} />
      </Section>

      {/* 06 — Reflections */}
      <Section num="06" eyebrow="Reflections">
        <div
          className="lp-two-col"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-9)',
            marginTop: 'var(--space-8)',
          }}
        >
          {reflections.map((r, i) => (
            <Reveal key={r.id} delay={i * 320}>
              <Reflection quote={r.quote} name={r.name} detail={r.detail} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* The number and the reply promise come from the company record, not
          from this sentence. They used to be typed here, and the first time
          the office changed the telephone number the home page kept the old
          one for three weeks. */}
      <BandInquiry
        src={IMG.bridge}
        height="70vh"
        eyebrow="Begin"
        title="Write to us"
        body={`Tell us what you are hoping for. A festival, a long walk, some days of silence. ${settings.contact.replyPromise}. Or call us at ${settings.contact.phone}.`}
      />
    </main>
  )
}
