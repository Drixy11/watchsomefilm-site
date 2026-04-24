const primaryLinks = [
  {
    label: 'Explore Camps',
    href: '/camps/',
    description: 'The public camp calendar and discovery hub will live here.'
  },
  {
    label: 'RouteRec',
    href: '#routerec',
    description: 'Our flagship platform for learning opponents and accelerating football cognition.'
  }
];

const pillars = [
  {
    title: 'Watch Some Film',
    body: 'A football-first company built to make the game easier to study, teach, and understand.'
  },
  {
    title: 'RouteRec',
    body: 'Our flagship product helps defenders learn route concepts faster through deterministic reps and football-correct presentation.'
  },
  {
    title: 'Camps',
    body: 'A cleaner public front door for camp discovery, organized for families, players, and coaches who just want the information without the nonsense.'
  }
];

const roadmap = [
  'Launch a clean company front door for Watch Some Film.',
  'Publish Camps under watchsomefilm.com/camps/.',
  'Expand product pages for RouteRec and future tools.'
];

export default function HomePage() {
  return (
    <main className="site-shell">
      <section className="hero-field">
        <div className="field-overlay" aria-hidden="true">
          <div className="endzone endzone-top">WATCH SOME FILM</div>
          <div className="field-core">
            <div className="yard-line" />
            <div className="yard-line" />
            <div className="yard-line" />
            <div className="yard-line" />
            <div className="hash-band left" />
            <div className="hash-band right" />
            <div className="midfield-mark" />
          </div>
          <div className="endzone endzone-bottom">ROUTEREC</div>
        </div>

        <div className="hero-content">
          <div className="eyebrow">Football tools with an actual point of view</div>
          <h1>Watch Some Film</h1>
          <p className="hero-copy">
            The company front door for football study tools, camp discovery, and smarter ways to help players
            see the game faster.
          </p>

          <div className="hero-actions">
            <a className="btn btn-gold" href="/camps/">Explore Camps</a>
            <a className="btn btn-dark" href="#routerec">See RouteRec</a>
          </div>

          <div className="hero-note">
            Built for coaches, players, and football people who are tired of clutter, guesswork, and bad information architecture.
          </div>
        </div>
      </section>

      <section className="pillars-section">
        <div className="section-heading">
          <span className="section-kicker">What lives here</span>
          <h2>A cleaner football ecosystem</h2>
        </div>
        <div className="pillars-grid">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="pillar-card">
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="links-section">
        <div className="section-heading">
          <span className="section-kicker">Start here</span>
          <h2>Current doors</h2>
        </div>
        <div className="link-cards">
          {primaryLinks.map((link) => (
            <a key={link.label} className="link-card" href={link.href}>
              <div>
                <span className="link-label">{link.label}</span>
                <p>{link.description}</p>
              </div>
              <span className="link-arrow">→</span>
            </a>
          ))}
        </div>
      </section>

      <section className="feature-split" id="routerec">
        <div className="feature-copy">
          <span className="section-kicker">Flagship product</span>
          <h2>RouteRec</h2>
          <p>
            RouteRec is built to accelerate defensive recognition through deterministic schematic reps—not fake realism,
            not random fluff, and not a cartoon pretending to be football IQ.
          </p>
          <ul>
            <li>Football-correct route study</li>
            <li>Deterministic playback and reps</li>
            <li>Built for actual coaching use, not buzzword demos</li>
          </ul>
        </div>
        <div className="feature-panel">
          <div className="feature-panel-inner">
            <span className="mini-kicker">Coming into focus</span>
            <h3>More product pages are coming.</h3>
            <p>
              This site is the clean front door. The deeper product breakdowns, demos, and ecosystem pages are next.
            </p>
          </div>
        </div>
      </section>

      <section className="roadmap-section">
        <div className="section-heading">
          <span className="section-kicker">What’s next</span>
          <h2>Short-term plan</h2>
        </div>
        <ol className="roadmap-list">
          {roadmap.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
