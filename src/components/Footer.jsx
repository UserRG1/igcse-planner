/**
 * Footer — small, tasteful legal links shown at the bottom of every page.
 */
export default function Footer() {
  return (
    <footer className="site-footer">
      <span className="site-footer-copy">
        © {new Date().getFullYear()} IGCSE Planner · Not affiliated with Cambridge International
      </span>
      <nav className="site-footer-links" aria-label="Legal">
        <a href="/privacy" className="site-footer-link">Privacy Policy</a>
        <span className="site-footer-sep" aria-hidden="true">·</span>
        <a href="/terms" className="site-footer-link">Terms of Service</a>
      </nav>
    </footer>
  );
}
