import Footer from '../components/Footer.jsx';

export default function TermsOfService() {
  return (
    <div className="legal-page">
      <div className="legal-wrap">
        <a className="legal-back" href="/">← Back to planner</a>

        <header className="legal-header">
          <p className="legal-kicker">Legal</p>
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-meta">Effective date: 30 April 2026 · Last updated: 9 May 2026</p>
        </header>

        <div className="legal-body">

          <section>
            <h2>1. Acceptance of terms</h2>
            <p>
              By accessing or using IGCSE Planner at <strong>igcseplanner.vercel.app</strong>{' '}
              (the "Service"), you agree to be bound by these Terms of Service. If you do
              not agree, please do not use the Service. These terms apply to all users,
              whether using the Service as a guest or as a registered account holder.
            </p>
          </section>

          <section>
            <h2>2. Description of the Service</h2>
            <p>
              IGCSE Planner is a free, independent web application that helps students
              organise and plan their Cambridge IGCSE May/June 2026 exam schedule. It
              provides a visual calendar, subject and paper selection, and export functionality.
            </p>
            <p>
              <strong>IGCSE Planner is not affiliated with, endorsed by, sponsored by, or
              in any way officially connected to Cambridge Assessment International Education
              (CAIE), Cambridge University Press & Assessment, or the University of Cambridge.</strong>{' '}
              All Cambridge syllabuses, subject codes, and timetable data referenced in the
              Service are the intellectual property of CAIE and are reproduced here solely
              for the personal, non-commercial educational use of individual students.
            </p>
          </section>

          <section>
            <h2>3. Accuracy of timetable data</h2>
            <p>
              We make reasonable efforts to keep exam dates, session times (AM/PM), and paper
              codes accurate and up to date based on official Cambridge timetable PDFs.
              However:
            </p>
            <ul>
              <li>Cambridge may publish corrections or amendments to its timetables at any time</li>
              <li>Session times and variant codes may differ between exam centres</li>
              <li>Timetable data for zones other than Zone 4 has been verified to a lower standard than Zone 4</li>
            </ul>
            <p>
              <strong>You are solely responsible for verifying all exam dates, times, and paper
              codes against the official Cambridge timetable published by your school or exam
              centre before your examinations.</strong> We accept no liability for any loss
              arising from reliance on information provided by this Service.
            </p>
          </section>

          <section>
            <h2>4. User accounts</h2>
            <ul>
              <li>You may use the Service without creating an account. Guest sessions store data locally in your browser only and expire after 3 hours.</li>
              <li>When you create an account, you agree to provide accurate information and to keep your login credentials secure.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must be at least 13 years old to create an account. Users under 18 should have parental or guardian awareness of their account.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section>
            <h2>5. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any purpose other than personal, non-commercial exam planning</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from the Service in bulk</li>
              <li>Introduce malware, viruses, or any code intended to disrupt the Service</li>
              <li>Attempt to gain unauthorised access to other users' accounts or to our infrastructure</li>
              <li>Use the Service in any way that violates applicable laws or regulations</li>
            </ul>
          </section>

          <section>
            <h2>6. Intellectual property</h2>
            <p>
              The code, design, and original content of IGCSE Planner are the property of
              its developers. Cambridge syllabus names, subject codes, and timetable data
              are the intellectual property of Cambridge Assessment International Education
              and are used here under fair use for educational purposes.
            </p>
            <p>
              You retain ownership of any personal notes or custom events you add to your
              planner. By using the Service, you grant us a limited licence to store and
              display that content solely to provide the Service to you.
            </p>
          </section>

          <section>
            <h2>7. Disclaimer of warranties</h2>
            <p>
              The Service is provided <strong>"as is"</strong> and <strong>"as available"</strong>,
              without warranty of any kind, express or implied. We do not warrant that the
              Service will be uninterrupted, error-free, or that any timetable data will be
              accurate, complete, or current. Your use of the Service is at your own risk.
            </p>
          </section>

          <section>
            <h2>8. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, IGCSE Planner and its developers shall
              not be liable for any indirect, incidental, special, consequential, or punitive
              damages — including but not limited to missed exams, data loss, or loss of
              study time — arising from your use of or inability to use the Service, even if
              we have been advised of the possibility of such damages.
            </p>
          </section>

          <section>
            <h2>9. Service availability and changes</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue the Service at any time
              without prior notice. We will endeavour to give reasonable notice of significant
              changes. We are not liable to you or any third party for any modification,
              suspension, or discontinuation of the Service.
            </p>
          </section>

          <section>
            <h2>10. Governing law</h2>
            <p>
              These terms are governed by and construed in accordance with the laws of
              England and Wales. Any disputes arising from these terms or your use of the
              Service shall be subject to the exclusive jurisdiction of the courts of
              England and Wales.
            </p>
          </section>

          <section>
            <h2>11. Changes to these terms</h2>
            <p>
              We may update these terms from time to time. Material changes will be
              communicated to registered users by email. Continued use of the Service after
              changes take effect constitutes acceptance of the revised terms. The "Last updated"
              date at the top of this page always reflects the most recent revision.
            </p>
          </section>

          <section>
            <h2>12. Contact</h2>
            <p>
              For any questions about these terms, please contact us at{' '}
              <a href="mailto:legal@igcseplanner.vercel.app">legal@igcseplanner.vercel.app</a>.
            </p>
          </section>

        </div>

        <Footer />
      </div>
    </div>
  );
}
