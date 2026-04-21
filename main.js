const THEME_KEY = 'pf-theme';

function getStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

function getSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function effectiveTheme() {
  if (getStoredTheme()) return getStoredTheme();
  return getSystemDark() ? 'dark' : 'light';
}

function syncMetaThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute('content', effectiveTheme() === 'dark' ? '#141210' : '#f4f0e8');
}

function initTheme() {
  const stored = getStoredTheme();
  const root = document.documentElement;
  if (stored) root.setAttribute('data-theme', stored);

  syncMetaThemeColor();

  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const label = btn.querySelector('.theme-toggle__label');

  function updateThemeButton() {
    const goesTo = effectiveTheme() === 'dark' ? 'light' : 'dark';
    if (label) label.textContent = goesTo === 'dark' ? 'Dark' : 'Light';
    btn.setAttribute(
      'aria-label',
      goesTo === 'dark' ? 'Switch to dark theme' : 'Switch to light theme',
    );
  }

  updateThemeButton();

  btn.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    root.setAttribute('data-theme', next);
    syncMetaThemeColor();
    updateThemeButton();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getStoredTheme()) {
      root.removeAttribute('data-theme');
      syncMetaThemeColor();
      updateThemeButton();
    }
  });
}

function initHeroParallax() {
  const aurora = document.querySelector('.hero-aurora');
  if (!aurora || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener(
    'pointermove',
    (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      aurora.style.setProperty('--parallax-x', x.toFixed(3));
      aurora.style.setProperty('--parallax-y', y.toFixed(3));
    },
    { passive: true },
  );
}

initTheme();
initHeroParallax();

const els = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -48px 0px' },
  );

  els.forEach((el) => io.observe(el));
} else {
  els.forEach((el) => el.classList.add('visible'));
}
