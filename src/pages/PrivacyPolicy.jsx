import Footer from '../components/Footer.jsx';

export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-wrap">
        <a className="legal-back" href="/">← Back to planner</a>

        <header className="legal-header">
          <p className="legal-kicker">Legal</p>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-meta">Effective date: 30 April 2026 · Last updated: 9 May 2026</p>
        </header>

        <div className="legal-body">

          <section>
            <h2>1. Who we are</h2>
            <p>
              IGCSE Planner (<strong>igcseplanner.vercel.app</strong>) is an independent, free
              educational tool that helps students plan Cambridge IGCSE May/June 2026 exams.
              It is not affiliated with, endorsed by, or connected to Cambridge Assessment
              International Education (CAIE) in any way.
            </p>
            <p>
              For privacy-related questions, contact us at{' '}
              <a href="mailto:privacy@igcseplanner.vercel.app">privacy@igcseplanner.vercel.app</a>.
            </p>
          </section>

          <section>
            <h2>2. What data we collect</h2>

            <h3>2a. Data you provide directly</h3>
            <ul>
              <li><strong>Email address</strong> — collected when you create an account or sign in with Google.</li>
              <li><strong>Full name</strong> — collected from your Google account when you use Google sign-in. You may use a pseudonym on a Google account if you prefer.</li>
              <li><strong>Profile picture URL</strong> — collected from your Google account if you sign in with Google. We store the URL only; the image itself is served by Google.</li>
              <li><strong>Exam selections and calendar events</strong> — the subjects, papers, and study notes you add to your planner. These are the primary data of the service.</li>
            </ul>

            <h3>2b. Data collected automatically</h3>
            <ul>
              <li>
                <strong>IP address and geolocation</strong> — when you first visit the site, we use a
                third-party service (<a href="https://ipapi.co" target="_blank" rel="noopener noreferrer">ipapi.co</a>)
                to detect your approximate location (country, city, region, latitude/longitude, timezone,
                and ISP/organisation). This is used to auto-detect your Cambridge administrative zone. We store the raw ipapi.co
                response associated with your account when you sign in.
              </li>
              <li><strong>Cambridge zone</strong> — the zone you select or that is auto-detected.</li>
              <li><strong>Last seen timestamp</strong> — updated each time you sign in.</li>
            </ul>

            <h3>2c. Data we do NOT collect</h3>
            <ul>
              <li>We do not use advertising cookies or third-party tracking pixels.</li>
              <li>We do not sell, rent, or share your personal data with any third party for marketing.</li>
              <li>We do not store payment information (the service is free).</li>
            </ul>
          </section>

          <section>
            <h2>3. How we store your data</h2>

            <h3>Signed-in users</h3>
            <p>
              Your account data, planner selections, and calendar events are stored in a
              PostgreSQL database hosted by <strong>Supabase</strong> (supabase.com),
              which is provisioned in the EU (London, eu-west-2) region. Supabase applies
              row-level security — your data is only accessible to your own authenticated
              account. Additionally, a local copy is kept in your browser's{' '}
              <code>localStorage</code> as an offline backup. This local copy is cleared
              when you sign out.
            </p>

            <h3>Guest users (not signed in)</h3>
            <p>
              If you use the planner without signing in, your data is stored only in your
              browser's <code>sessionStorage</code> and expires after 3 hours or when you
              close the tab — whichever comes first. No data is sent to our servers for
              guest sessions.
            </p>
          </section>

          <section>
            <h2>4. Third-party services</h2>
            <table className="legal-table">
              <thead>
                <tr><th>Service</th><th>Purpose</th><th>Data shared</th><th>Privacy policy</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Supabase</td>
                  <td>Database and authentication hosting</td>
                  <td>Email, name, planner data, geo data</td>
                  <td><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a></td>
                </tr>
                <tr>
                  <td>Google OAuth</td>
                  <td>Sign-in with Google</td>
                  <td>Email, name, profile picture URL</td>
                  <td><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a></td>
                </tr>
                <tr>
                  <td>ipapi.co</td>
                  <td>IP geolocation for zone auto-detection</td>
                  <td>Your IP address (on page load)</td>
                  <td><a href="https://ipapi.co/privacy/" target="_blank" rel="noopener noreferrer">ipapi.co/privacy</a></td>
                </tr>
                <tr>
                  <td>Vercel</td>
                  <td>Web hosting and CDN</td>
                  <td>Standard server logs (IP, user agent)</td>
                  <td><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a></td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>5. How we use your data</h2>
            <ul>
              <li>To provide and sync your exam planner across devices</li>
              <li>To auto-detect your Cambridge administrative zone</li>
              <li>To understand the geographic distribution of our users (aggregate, not individually targeted)</li>
              <li>To contact you about significant service changes (email only, infrequently)</li>
            </ul>
            <p>We do not use your data for advertising, profiling, or automated decision-making.</p>
          </section>

          <section>
            <h2>6. Your rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access</strong> — request a copy of all data we hold about you</li>
              <li><strong>Correction</strong> — request that inaccurate data be corrected</li>
              <li><strong>Deletion</strong> — request that your account and all associated data be deleted. Email us at <a href="mailto:privacy@igcseplanner.vercel.app">privacy@igcseplanner.vercel.app</a> and we will action this within 30 days.</li>
              <li><strong>Portability</strong> — request your planner data in a portable format (JSON or CSV)</li>
              <li><strong>Withdraw consent</strong> — stop using the service and request data deletion at any time</li>
            </ul>
            <p>
              If you are located in the European Economic Area or United Kingdom, you also have
              rights under GDPR, including the right to lodge a complaint with your local
              supervisory authority.
            </p>
          </section>

          <section>
            <h2>7. Data retention</h2>
            <p>
              We retain your account data for as long as your account is active.
              If you have not signed in for 24 months, we may delete your account and
              associated data after giving 30 days' notice to your registered email address.
              You may request deletion at any time as described above.
            </p>
          </section>

          <section>
            <h2>8. Children's privacy</h2>
            <p>
              IGCSE students are typically 14–16 years old. We do not knowingly collect data
              from children under 13. If you are under 13, please do not create an account —
              use the guest mode instead. If you are 13–17, we recommend informing a parent
              or guardian that you are creating an account.
            </p>
          </section>

          <section>
            <h2>9. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will notify signed-in users
              by email of material changes. The "Last updated" date at the top of this page
              will always reflect the most recent revision. Continued use of the service
              after a change constitutes acceptance of the revised policy.
            </p>
          </section>

        </div>

        <Footer />
      </div>
    </div>
  );
}
