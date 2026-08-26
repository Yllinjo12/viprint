/* Viprint — small interactions */

// Current year in the footer
document.getElementById('year').textContent = new Date().getFullYear();

// Mobile navigation toggle
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');

navToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

// Close the mobile menu when a link is clicked
mainNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Animated counters for the Facts section
function animateCounters() {
  const counters = document.querySelectorAll('.fact-number[data-count]');
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const duration = 1400;
        const start = performance.now();

        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          el.textContent = Math.round(target * eased).toLocaleString();
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach((c) => io.observe(c));
}

// Reveal-on-scroll animation
function initReveal() {
  const targets = document.querySelectorAll('.about-card, .product-card, .service, .fact, .contact-form, .contact-list, .game-how, .game-wrap');
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  targets.forEach((t) => {
    t.classList.add('reveal');
    io.observe(t);
  });
}

// Contact form (demo — no backend)
const form = document.getElementById('contactForm');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  document.getElementById('formNote').hidden = false;
  form.reset();
});

animateCounters();
initReveal();
