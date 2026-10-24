import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ChatWidget from '../components/ChatWidget';

function ImpactCounter({ value, suffix = '', decimals = 0 }) {
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const counterRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;

    const duration = 1400;
    const start = performance.now();
    let frame;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);

      setCurrent(value * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [started, value]);

  return (
    <span ref={counterRef}>
      {current.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}
      {suffix}
    </span>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    collectors: 0,
    recyclers: 0,
    totalKg: 0,
    co2: 0
  });

  useEffect(() => {
    api.publicStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="landing-page">

      {/* ================= NAVBAR ================= */}

      <header className="home-navbar">
        <div className="home-navbar-inner">

          <button
            className="home-brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <span className="home-brand-icon">♻</span>

            <span>
              Kabadiwala
              <b>Connect</b>
            </span>
          </button>

          <nav className="home-nav-links">
            <button className="active">Home</button>

            <button
              onClick={() =>
                document
                  .getElementById('how-it-works')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              How It Works
            </button>

            <button
              onClick={() =>
                document
                  .getElementById('services')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Services
            </button>

            <button
              onClick={() =>
                document
                  .getElementById('about')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              About
            </button>
          </nav>

          <div className="home-nav-actions">
            <button
              className="home-login-btn"
              onClick={() => navigate('/login')}
            >
              Login
            </button>

            <button
              className="home-start-btn"
              onClick={() => navigate('/register')}
            >
              Get Started
            </button>
          </div>

        </div>
      </header>


      {/* ================= HERO ================= */}

      <section className="home-hero">

        <div className="home-hero-inner">

          <div className="home-hero-content">

            <div className="home-eyebrow">
              <span>●</span>
              CLEANER COMMUNITIES
              <b>•</b>
              GREENER TOMORROW
            </div>

            <h1>
                 Turn Your Waste Into a
              <span>Better Tomorrow</span>
            </h1>

            <p>
              Schedule a pickup, connect with verified collectors,
              and help keep your community cleaner.
            </p>

            <div className="home-hero-buttons">

              <button
                className="home-primary-btn"
                onClick={() => navigate('/login')}
              >
                <span>▣</span>
                Schedule a Pickup
                <b>→</b>
              </button>

              <button
                className="home-secondary-btn"
                onClick={() => navigate('/login')}
              >
                <span>♟</span>
                Become a Collector
              </button>

            </div>

            <div className="home-trust-items">

              <div>
                <span>♙</span>
                <b>Easy & Convenient</b>
              </div>

              <div>
                <span>✓</span>
                <b>Verified Collectors</b>
              </div>

              <div>
                <span>♻</span>
                <b>Eco Friendly</b>
              </div>

            </div>

          </div>


          {/* HERO IMAGE */}

          <div className="home-hero-visual">

            <div className="hero-image-glow" />

            <img
              src="/hero-kabadiwala.png"
              alt="Kabadiwala Connect waste recycling"
              className="hero-main-image"
            />

            <div className="hero-floating-card">

              <span className="hero-card-icon">▣</span>

              <div>
                <strong>Pickup Scheduled</strong>
                <small>Today, 10:00 AM</small>
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ================= STATS ================= */}

      <section className="home-stats">

        <div className="home-stats-inner">

          <div className="home-stat">
            <span className="home-stat-icon">🚚</span>
            <div>
              <strong>
                <ImpactCounter value={10000} suffix="+" />
              </strong>
              <small>Pickups Completed</small>
            </div>
          </div>

          <div className="home-stat">
            <span className="home-stat-icon">👥</span>
            <div>
              <strong>
                <ImpactCounter value={5000} suffix="+" />
              </strong>
              <small>Happy Customers</small>
            </div>
          </div>

          <div className="home-stat">
            <span className="home-stat-icon">🛡</span>
            <div>
              <strong>
                <ImpactCounter value={2000} suffix="+" />
              </strong>
              <small>Verified Collectors</small>
            </div>
          </div>

          <div className="home-stat">
            <span className="home-stat-icon">🌿</span>
            <div>
              <strong>
                <ImpactCounter value={50000} suffix="+" />
              </strong>
              <small>Kg Recycled</small>
            </div>
          </div>

        </div>

      </section>


      {/* ================= HOW IT WORKS ================= */}

      <section
        id="how-it-works"
        className="home-section home-how"
      >

        <div className="home-section-heading">

          <div className="home-section-label">
            ● HOW IT WORKS
          </div>

          <h2>Simple Steps, Big Impact</h2>

          <p>
            Recycling your waste has never been easier.
          </p>

        </div>

        <div className="home-steps">

          <div className="home-step">

            <div className="home-step-icon">
              📍
            </div>

            <span className="home-step-number">1</span>

            <h3>Choose Your Location</h3>

            <p>
              Select your pickup location on the map.
            </p>

          </div>


          <div className="home-step-arrow">→</div>


          <div className="home-step">

            <div className="home-step-icon">
              📅
            </div>

            <span className="home-step-number">2</span>

            <h3>Schedule a Pickup</h3>

            <p>
              Choose a convenient date and time.
            </p>

          </div>


          <div className="home-step-arrow">→</div>


          <div className="home-step">

            <div className="home-step-icon">
              👤
            </div>

            <span className="home-step-number">3</span>

            <h3>Collector Arrives</h3>

            <p>
              Our verified collector will reach your location.
            </p>

          </div>


          <div className="home-step-arrow">→</div>


          <div className="home-step">

            <div className="home-step-icon">
              ♻️
            </div>

            <span className="home-step-number">4</span>

            <h3>Waste Gets Recycled</h3>

            <p>
              Your waste is processed for a cleaner planet.
            </p>

          </div>

        </div>

      </section>


      {/* ================= SERVICES ================= */}

      <section
        id="services"
        className="home-services"
      >

        <div className="home-services-inner">

          <div className="home-section-heading home-services-heading">

            <div className="home-section-label">
              ● OUR SERVICES
            </div>

            <h2>What We Collect</h2>

          </div>


          <div className="service-cards">

            <div className="service-card">
              <div className="service-icon orange">🏠</div>
              <h3>Household Waste</h3>
              <p>
                General household recyclables and waste
              </p>
            </div>

            <div className="service-card">
              <div className="service-icon green">💻</div>
              <h3>E-Waste Collection</h3>
              <p>
                Old electronics and appliances
              </p>
            </div>

            <div className="service-card">
              <div className="service-icon blue">♻️</div>
              <h3>Paper & Plastic</h3>
              <p>
                Paper, plastic and packaging waste
              </p>
            </div>

            <div className="service-card">
              <div className="service-icon grey">🔩</div>
              <h3>Metal Scrap</h3>
              <p>
                Iron, steel and metal materials
              </p>
            </div>

            <div className="service-card">
              <div className="service-icon cyan">📅</div>
              <h3>Scheduled Pickups</h3>
              <p>
                Regular pickup for your convenience
              </p>
            </div>

            <div className="service-card">
              <div className="service-icon lime">🌱</div>
              <h3>Responsible Recycling</h3>
              <p>
                Turning waste into new resources
              </p>
            </div>

          </div>

        </div>

      </section>


      {/* ================= WHY US ================= */}

      <section
        id="about"
        className="home-about"
      >

        <div className="home-about-inner">

          <div className="about-visual">

            <div className="about-circle">
              ♻️
            </div>

            <div className="about-leaf leaf-one">🍃</div>
            <div className="about-leaf leaf-two">🌿</div>

          </div>


          <div className="about-content">

            <div className="home-section-label">
              ● WHY KABADIWALA CONNECT
            </div>

            <h2>
              A Smarter Way to
              <span>Recycle</span>
            </h2>

            <div className="about-features">

              <div>
                <span>✓</span>
                <section>
                  <strong>Verified Collectors</strong>
                  <small>
                    Connect with trusted local collectors.
                  </small>
                </section>
              </div>

              <div>
                <span>📅</span>
                <section>
                  <strong>Easy Scheduling</strong>
                  <small>
                    Book a pickup in just a few steps.
                  </small>
                </section>
              </div>

              <div>
                <span>📍</span>
                <section>
                  <strong>Location Based Pickup</strong>
                  <small>
                    Choose your pickup location.
                  </small>
                </section>
              </div>

              <div>
                <span>🔎</span>
                <section>
                  <strong>Transparent Tracking</strong>
                  <small>
                    Follow your pickup status.
                  </small>
                </section>
              </div>

              <div>
                <span>♻</span>
                <section>
                  <strong>Responsible Recycling</strong>
                  <small>
                    Help create a cleaner future.
                  </small>
                </section>
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ================= IMPACT ================= */}

      <section className="home-impact">

        <div className="home-impact-inner">

          <div className="home-impact-heading">

            <div className="home-impact-label">
              ● OUR ENVIRONMENTAL IMPACT
            </div>

            <h2>
              Together for a
              <span>Greener Planet</span>
            </h2>

            <p>
              Every pickup makes a difference. Here's the
              impact we're creating together.
            </p>

          </div>


          <div className="home-impact-stats">

            <div>
              <span>🌿</span>
              <strong>
                <ImpactCounter
                  value={stats.totalKg || 50000}
                  suffix="+"
                />
              </strong>
              <small>Kg Waste Collected</small>
            </div>

            <div>
              <span>🌲</span>
              <strong>
                <ImpactCounter value={12000} suffix="+" />
              </strong>
              <small>Trees Saved</small>
            </div>

            <div>
              <span>☁️</span>
              <strong>
                <ImpactCounter
                  value={stats.co2 || 25000}
                  suffix="+"
                />
              </strong>
              <small>CO₂ Reduced</small>
            </div>

            <div>
              <span>♻️</span>
              <strong>
                <ImpactCounter value={10000} suffix="+" />
              </strong>
              <small>Pickups Completed</small>
            </div>

          </div>

        </div>

      </section>


      {/* ================= CTA ================= */}

      <section className="home-final-cta">

        <div>

          <span className="cta-leaf">🍃</span>

          <div>
            <h2>Ready to Give Your Waste a Second Life?</h2>
            <p>
              Book a pickup today and become part of a cleaner community.
            </p>
          </div>

        </div>

        <button
          onClick={() => navigate('/login')}
        >
          Schedule a Pickup
          <span>→</span>
        </button>

      </section>


      {/* ================= FOOTER ================= */}

      <footer className="home-footer">

        <div className="home-footer-inner">

          <div className="footer-brand">

            <div className="home-brand">
              <span className="home-brand-icon">♻</span>

              <span>
                Kabadiwala
                <b>Connect</b>
              </span>
            </div>

            <p>
              Connecting people, collectors and recycling
              centers for a cleaner, greener tomorrow.
            </p>

          </div>


          <div className="footer-column">
            <h4>Quick Links</h4>
            <button>Home</button>
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'})}>
              How It Works
            </button>
            <button onClick={() => document.getElementById('services')?.scrollIntoView({behavior:'smooth'})}>
              Services
            </button>
            <button onClick={() => document.getElementById('about')?.scrollIntoView({behavior:'smooth'})}>
              About
            </button>
          </div>


          <div className="footer-column">
            <h4>Customer</h4>
            <button onClick={() => navigate('/login')}>
              Login
            </button>
            <button onClick={() => navigate('/register')}>
              Get Started
            </button>
          </div>


          <div className="footer-column">
            <h4>Collector</h4>
            <button onClick={() => navigate('/login')}>
              Login
            </button>
            <button onClick={() => navigate('/login')}>
              Become a Collector
            </button>
          </div>


          <div className="footer-message">
            <span>🍃</span>
            <p>
              Better Waste Management
              <br />
              for a Cleaner Future
            </p>
          </div>

        </div>


        <div className="footer-bottom">
          <span>
            © 2026 Kabadiwala Connect — Hackathon Prototype
          </span>

          <span>
            Prices & impact figures are demo estimates.
          </span>
        </div>

      </footer>

      <ChatWidget />
    </div>
  );
}