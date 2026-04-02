import { useState, useEffect, useRef } from "react";

const PRIMARY = "#E8420A";
const PRIMARY_20 = "rgba(232,66,10,0.2)";
const PRIMARY_40 = "rgba(232,66,10,0.4)";

// Same content from the original
const CONTENT = {
  en: {
    eyebrow: "BIKERZ Academy — Professional Riding",
    titleLine1: "RIDE",
    titleLine2: "FREE",
    subtitle: "Start your journey with expert motorcycle instructors — from basics to mastery",
    cta: "Explore Courses",
    secondaryCta: "Join Community",
    startNow: "Start Now",
    navLinks: ["Courses", "Instructors", "Community"],
    stats: [
      { value: "2K+", label: "Members" },
      { value: "94%", label: "Success Rate" },
      { value: "120+", label: "Lessons" },
    ],
    scroll: "scroll",
  },
};

/* ─── Animated counter ─── */
function AnimCount({ text, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <span
      style={{
        display: "inline-block",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(18px)",
        transition: "opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1)",
      }}
    >
      {text}
    </span>
  );
}

/* ─── Reveal wrapper ─── */
function Reveal({ children, delay = 0, y = 30, x = 0, style = {}, className = "" }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(0,0)" : `translate(${x}px,${y}px)`,
        transition: `opacity .8s cubic-bezier(.22,1,.36,1) 0s, transform .8s cubic-bezier(.22,1,.36,1) 0s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function HeroSection() {
  const c = CONTENT.en;
  const [imgLoaded, setImgLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .hero-root {
          --primary: ${PRIMARY};
          --primary-20: ${PRIMARY_20};
          --primary-40: ${PRIMARY_40};
          position: relative;
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #000;
          font-family: 'DM Sans', sans-serif;
          color: #fff;
        }

        /* ── Background image ── */
        .hero-bg {
          position: absolute; inset: 0; z-index: 0;
          transform: scale(1.08);
          animation: heroZoom 3s cubic-bezier(.25,.46,.45,.94) forwards;
        }
        @keyframes heroZoom { to { transform: scale(1); } }

        .hero-bg img {
          width: 100%; height: 100%;
          object-fit: cover; object-position: center;
          display: block;
        }

        /* ── Overlays ── */
        .hero-overlay-bottom {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(
            to top,
            rgba(0,0,0,.98) 0%,
            rgba(0,0,0,.72) 22%,
            rgba(0,0,0,.25) 50%,
            transparent 75%
          );
        }
        .hero-overlay-top {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(to bottom, rgba(0,0,0,.55) 0%, transparent 25%);
        }
        /* Side vignette for depth */
        .hero-overlay-vignette {
          position: absolute; inset: 0; z-index: 1;
          background: radial-gradient(ellipse 120% 100% at 80% 50%, transparent 50%, rgba(0,0,0,.5) 100%);
        }

        /* ── Letterbox bars ── */
        .letterbox { position: absolute; left: 0; right: 0; height: 52px; background: #000; z-index: 20; }
        .letterbox-top { top: 0; }
        .letterbox-bottom { bottom: 0; }

        /* ── Navbar ── */
        .hero-nav {
          position: absolute; top: 0; left: 0; right: 0; z-index: 30;
          display: flex; align-items: center; justify-content: space-between;
          height: 52px; padding: 0 clamp(20px, 4vw, 48px);
        }
        .nav-logo {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none;
        }
        .nav-logo-icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: var(--primary);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .nav-logo-text {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 900; font-size: 17px;
          letter-spacing: .18em; text-transform: uppercase;
          color: #fff;
        }
        .nav-logo-text span { color: var(--primary); }

        .nav-links {
          display: flex; align-items: center; gap: 2px;
        }
        .nav-link {
          background: none; border: none; cursor: pointer;
          padding: 6px 16px;
          font-size: 10.5px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .14em; color: rgba(255,255,255,.4);
          transition: color .15s;
          font-family: 'DM Sans', sans-serif;
        }
        .nav-link:hover { color: #fff; }

        .nav-cta {
          font-size: 10.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .14em; color: var(--primary);
          border: 1px solid rgba(232,66,10,.35);
          background: rgba(232,66,10,.06);
          padding: 7px 20px; border-radius: 6px;
          cursor: pointer; text-decoration: none;
          font-family: 'DM Sans', sans-serif;
          transition: background .15s, border-color .15s;
        }
        .nav-cta:hover {
          background: rgba(232,66,10,.16);
          border-color: rgba(232,66,10,.7);
        }

        /* ── Mobile menu toggle ── */
        .menu-toggle {
          display: none;
          background: none; border: none; cursor: pointer; padding: 6px;
        }
        .menu-toggle span {
          display: block; width: 22px; height: 2px;
          background: rgba(255,255,255,.6); border-radius: 1px;
          transition: transform .25s, opacity .2s;
        }
        .menu-toggle span + span { margin-top: 5px; }
        .menu-toggle.open span:nth-child(1) { transform: rotate(45deg) translate(2.5px, 5px); }
        .menu-toggle.open span:nth-child(2) { opacity: 0; }
        .menu-toggle.open span:nth-child(3) { transform: rotate(-45deg) translate(2.5px, -5px); }

        /* ── Main content ── */
        .hero-content {
          position: relative; z-index: 10;
          margin-top: auto;
          padding: 0 clamp(20px, 4vw, 48px);
          padding-bottom: clamp(90px, 12vh, 140px);
          max-width: 720px;
        }

        .eyebrow {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 20px;
        }
        .eyebrow-line {
          width: 32px; height: 2px; border-radius: 1px;
          background: var(--primary);
          flex-shrink: 0;
        }
        .eyebrow-text {
          font-size: 10px; font-weight: 600;
          text-transform: uppercase; letter-spacing: .22em;
          color: rgba(255,255,255,.35);
        }

        .hero-title {
          font-family: 'Barlow Condensed', 'Impact', sans-serif;
          font-weight: 900; text-transform: uppercase;
          line-height: .88; letter-spacing: -2px;
          margin-bottom: 24px;
          font-size: clamp(72px, 14vw, 150px);
        }
        .hero-title-outline {
          display: block;
          -webkit-text-stroke: 1.5px rgba(255,255,255,.2);
          color: transparent;
        }
        .hero-title-solid {
          display: block;
          color: var(--primary);
          position: relative;
        }
        /* Glow behind solid text */
        .hero-title-solid::after {
          content: attr(data-text);
          position: absolute; left: 0; top: 0;
          color: var(--primary);
          filter: blur(40px);
          opacity: .35;
          z-index: -1;
        }

        .hero-subtitle {
          font-size: clamp(13.5px, 1.6vw, 16px);
          font-weight: 400; color: rgba(255,255,255,.45);
          line-height: 1.75;
          max-width: 400px;
          margin-bottom: 36px;
          padding-left: 16px;
          border-left: 2px solid var(--primary-40);
        }

        /* ── CTA ── */
        .hero-ctas {
          display: flex; align-items: center; gap: 24px;
          flex-wrap: wrap;
        }
        .cta-primary {
          display: inline-flex; align-items: center; gap: 10px;
          background: var(--primary); color: #fff;
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 700; font-size: 13px;
          text-transform: uppercase; letter-spacing: .14em;
          padding: 14px 32px; border-radius: 6px;
          border: none; cursor: pointer;
          text-decoration: none;
          transition: transform .15s, box-shadow .25s;
          box-shadow: 0 0 0 0 rgba(232,66,10,0);
        }
        .cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(232,66,10,.35);
        }
        .cta-primary:active { transform: scale(.97); }

        .cta-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          color: rgba(255,255,255,.5);
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 700; font-size: 12px;
          text-transform: uppercase; letter-spacing: .14em;
          background: none; border: none; cursor: pointer;
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,.15);
          padding-bottom: 2px;
          transition: color .15s, border-color .15s;
        }
        .cta-secondary:hover {
          color: #fff; border-color: rgba(255,255,255,.5);
        }

        /* ── Stats ── */
        .hero-stats {
          position: absolute;
          bottom: clamp(80px, 10vh, 120px);
          right: clamp(20px, 4vw, 48px);
          z-index: 10;
          display: flex; gap: 0;
        }
        .stat-item {
          text-align: center;
          padding: 0 clamp(16px, 2.2vw, 28px);
          border-right: 1px solid rgba(255,255,255,.08);
        }
        .stat-item:last-child { border-right: none; }
        .stat-value {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 900; font-size: clamp(26px, 3.5vw, 38px);
          color: var(--primary);
          line-height: 1;
        }
        .stat-label {
          font-size: 9px; font-weight: 600;
          text-transform: uppercase; letter-spacing: .18em;
          color: rgba(255,255,255,.25);
          margin-top: 4px;
        }

        /* ── Scroll indicator ── */
        .scroll-indicator {
          position: absolute;
          bottom: 56px; left: 50%; transform: translateX(-50%);
          z-index: 10;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .scroll-capsule {
          width: 18px; height: 28px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 100px;
          display: flex; justify-content: center;
          padding-top: 5px;
          overflow: hidden;
        }
        .scroll-dot {
          width: 2px; height: 8px; border-radius: 1px;
          background: var(--primary);
          animation: scrollPulse 1.8s ease-in infinite;
        }
        @keyframes scrollPulse {
          0%   { transform: translateY(0); opacity: 1; }
          50%  { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 0; }
        }
        .scroll-text {
          font-size: 8px; font-weight: 600;
          text-transform: uppercase; letter-spacing: .22em;
          color: rgba(255,255,255,.18);
        }

        /* ── Decorative vertical line ── */
        .deco-line {
          position: absolute;
          right: clamp(42px, 6vw, 80px);
          top: 52px; bottom: 52px;
          width: 1px;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(255,255,255,.06) 30%,
            rgba(255,255,255,.06) 70%,
            transparent 100%
          );
          z-index: 5;
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .nav-links { display: none; }
          .menu-toggle { display: flex; flex-direction: column; }
          .hero-stats {
            position: relative;
            bottom: auto; right: auto;
            padding: 0 clamp(20px, 4vw, 48px);
            padding-bottom: clamp(80px, 10vh, 120px);
            margin-top: 32px;
            justify-content: flex-start;
          }
          .hero-content {
            padding-bottom: 0;
          }
          .deco-line { display: none; }
        }

        @media (max-width: 480px) {
          .hero-title { letter-spacing: -1px; }
          .stat-item { padding: 0 14px; }
          .hero-subtitle { max-width: 100%; }
          .letterbox { height: 40px; }
          .hero-nav { height: 40px; }
          .scroll-indicator { bottom: 44px; }
        }

        /* ── Mobile menu overlay ── */
        .mobile-menu {
          position: fixed; inset: 0; z-index: 25;
          background: rgba(0,0,0,.95);
          backdrop-filter: blur(20px);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px;
          opacity: 0; pointer-events: none;
          transition: opacity .25s;
        }
        .mobile-menu.open { opacity: 1; pointer-events: all; }
        .mobile-menu a, .mobile-menu button {
          background: none; border: none; cursor: pointer;
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 700; font-size: 28px;
          text-transform: uppercase; letter-spacing: .1em;
          color: rgba(255,255,255,.5);
          padding: 12px 24px; text-decoration: none;
          transition: color .15s;
        }
        .mobile-menu a:hover, .mobile-menu button:hover { color: var(--primary); }
      `}</style>

      <section className="hero-root">
        {/* BG Image */}
        <div className="hero-bg">
          <img
            src="https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1920&q=85&auto=format"
            alt=""
            onLoad={() => setImgLoaded(true)}
            loading="eager"
            fetchpriority="high"
          />
        </div>

        {/* Overlays */}
        <div className="hero-overlay-bottom" />
        <div className="hero-overlay-top" />
        <div className="hero-overlay-vignette" />

        {/* Letterbox */}
        <div className="letterbox letterbox-top" />
        <div className="letterbox letterbox-bottom" />

        {/* Decorative line */}
        <div className="deco-line" />

        {/* Nav */}
        <Reveal delay={100} y={0} style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30 }}>
          <nav className="hero-nav">
            <a className="nav-logo" href="#">
              <div className="nav-logo-icon">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="nav-logo-text">
                BIKER<span>Z</span>
              </span>
            </a>

            <div className="nav-links">
              {c.navLinks.map((l) => (
                <button key={l} className="nav-link">
                  {l}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <a className="nav-cta" href="#">
                {c.startNow}
              </a>
              <button
                className={`menu-toggle ${menuOpen ? "open" : ""}`}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          </nav>
        </Reveal>

        {/* Mobile menu */}
        <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
          {c.navLinks.map((l) => (
            <button key={l} onClick={() => setMenuOpen(false)}>
              {l}
            </button>
          ))}
          <a href="#" style={{ color: PRIMARY, marginTop: 16 }} onClick={() => setMenuOpen(false)}>
            {c.startNow}
          </a>
        </div>

        {/* Main content */}
        <div className="hero-content">
          <Reveal delay={300} x={-16} y={0}>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              <span className="eyebrow-text">{c.eyebrow}</span>
            </div>
          </Reveal>

          <Reveal delay={420} y={36}>
            <h1 className="hero-title">
              <span className="hero-title-outline">{c.titleLine1}</span>
              <span className="hero-title-solid" data-text={c.titleLine2}>
                {c.titleLine2}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={580}>
            <p className="hero-subtitle">{c.subtitle}</p>
          </Reveal>

          <Reveal delay={700} y={16}>
            <div className="hero-ctas">
              <a className="cta-primary" href="#">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {c.cta}
              </a>
              <a className="cta-secondary" href="#">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {c.secondaryCta}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
          </Reveal>
        </div>

        {/* Stats */}
        <Reveal delay={900} y={0} x={0} className="hero-stats">
          {c.stats.map((s, i) => (
            <div className="stat-item" key={s.label}>
              <div className="stat-value">
                <AnimCount text={s.value} delay={1000 + i * 140} />
              </div>
              <p className="stat-label">{s.label}</p>
            </div>
          ))}
        </Reveal>

        {/* Scroll indicator */}
        <Reveal delay={1300} className="scroll-indicator">
          <div className="scroll-capsule">
            <div className="scroll-dot" />
          </div>
          <span className="scroll-text">{c.scroll}</span>
        </Reveal>
      </section>
    </>
  );
}
