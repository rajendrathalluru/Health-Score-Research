import express from 'express';

const router = express.Router();

const SHARED_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f9fafb;
    color: #1f2937;
    line-height: 1.7;
  }
  header {
    background: #047857;
    color: white;
    padding: 24px 32px;
  }
  header h1 { font-size: 1.5rem; font-weight: 700; }
  header p { font-size: 0.9rem; opacity: 0.85; margin-top: 4px; }
  main {
    max-width: 800px;
    margin: 40px auto;
    padding: 0 24px 60px;
  }
  .card {
    background: white;
    border-radius: 12px;
    padding: 36px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  h2 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #047857;
    margin: 28px 0 8px;
    padding-bottom: 6px;
    border-bottom: 2px solid #d1fae5;
  }
  h2:first-child { margin-top: 0; }
  p { margin-bottom: 12px; font-size: 0.95rem; color: #374151; }
  ul { margin: 8px 0 12px 20px; }
  li { margin-bottom: 6px; font-size: 0.95rem; color: #374151; }
  .badge {
    display: inline-block;
    background: #d1fae5;
    color: #065f46;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 99px;
    margin-left: 8px;
    vertical-align: middle;
  }
  .highlight {
    background: #f0fdf4;
    border-left: 4px solid #047857;
    border-radius: 4px;
    padding: 12px 16px;
    margin: 12px 0;
    font-size: 0.9rem;
    color: #374151;
  }
  .updated {
    font-size: 0.85rem;
    color: #6b7280;
    margin-top: 32px;
    text-align: center;
  }
  code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.88em;
  }
  a { color: #047857; }
`;

const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy – ThriveScore Tracker</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
<header>
  <h1>ThriveScore Tracker</h1>
  <p>WCRF/AICR Cancer Prevention Score Calculator</p>
</header>
<main>
  <div class="card">
    <h2>Privacy Policy <span class="badge">Effective: November 21, 2026</span></h2>
    <p>
      ThriveScore Tracker ("we", "our", or "us") is committed to protecting your personal information.
      This Privacy Policy explains what data we collect, how we use it, and your rights regarding that data
      when you use our WCRF/AICR Cancer Prevention Score Calculator application.
    </p>

    <h2>1. Information We Collect</h2>
    <p>We collect the following types of information:</p>
    <ul>
      <li><strong>Account Information:</strong> Name, email address, and password (hashed) or Google Sign-In identity when you register.</li>
      <li><strong>Health &amp; Fitness Data (via Google Health API):</strong> Read-only physical activity data (steps, moderate/vigorous active minutes, Active Zone Minutes) and body measurements (weight, height) synced through the Google Health API with your explicit OAuth 2.0 consent.</li>
      <li><strong>Weekly Questionnaire Responses:</strong> Diet and lifestyle questionnaire responses you enter to calculate your weekly WCRF/AICR score.</li>
      <li><strong>Profile &amp; Body Measurements:</strong> Height, weight, BMI, and optional survivorship profile details you provide.</li>
      <li><strong>Usage Data:</strong> Basic application logs needed to operate and secure the service.</li>
    </ul>

    <h2>2. How We Use Your Data</h2>
    <p>Your data is used solely for the following purposes:</p>
    <ul>
      <li>Calculating your weekly WCRF/AICR Cancer Prevention Score.</li>
      <li>Displaying your health dashboard, activity summaries, body metrics, and progress trends over time.</li>
      <li>Syncing read-only activity and body measurements from your connected Google Health account.</li>
      <li>Maintaining and securing the application.</li>
    </ul>
    <p>We do <strong>not</strong> sell, rent, or share your personal or health data with third parties for advertising, marketing, or data brokering purposes.</p>

    <h2>3. Google Health API Data &amp; Limited Use Disclosure</h2>
    <p>
      When you connect your Google Health account, ThriveScore Tracker accesses your data via the official
      Google Health API (<code>health.googleapis.com</code>) using OAuth 2.0. We request only the minimum
      read-only scopes necessary:
    </p>
    <ul>
      <li><code>googlehealth.activity_and_fitness.readonly</code> — to read steps, active minutes, and Active Zone Minutes for your weekly activity score and charts.</li>
      <li><code>googlehealth.health_metrics_and_measurements.readonly</code> — to read weight and height for your BMI and healthy weight score.</li>
    </ul>
    <p>
      <strong>Google API Services User Data Policy (Limited Use):</strong> ThriveScore Tracker's use and transfer
      to any other app of information received from Google APIs will adhere to the
      <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
      including the Limited Use requirements. We do not use Google Health data for advertising, do not transfer
      it to third-party data brokers, and do not use it to train generalized AI/ML models.
    </p>
    <p>
      You can disconnect Google Health inside the ThriveScore Activity page or revoke access at any time from your
      Google Account permissions at
      <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.
    </p>

    <h2>4. Data Storage &amp; Security</h2>
    <p>
      All data is stored in a secured PostgreSQL database. Passwords are hashed using industry-standard
      algorithms and never stored in plain text. We use JWT-based authentication and HTTPS to protect
      data in transit.
    </p>

    <h2>5. Data Retention</h2>
    <p>
      We retain your data for as long as your account is active. You may request deletion of your account
      and all associated data at any time by contacting us.
    </p>

    <h2>6. Your Rights</h2>
    <ul>
      <li>Access the personal data we hold about you.</li>
      <li>Correct inaccurate data.</li>
      <li>Request deletion of your account and data.</li>
      <li>Withdraw consent for Google Health data access at any time.</li>
    </ul>

    <h2>7. Third-Party Services</h2>
    <p>We integrate with the following third-party services, each governed by their own privacy policies:</p>
    <ul>
      <li><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a> (Google Sign-In &amp; Google Health API)</li>
    </ul>

    <h2>8. Children's Privacy</h2>
    <p>
      This application is not intended for use by individuals under the age of 13. We do not knowingly
      collect data from children.
    </p>

    <h2>9. Changes to This Policy</h2>
    <p>
      We may update this Privacy Policy from time to time. Changes will be posted on this page with an
      updated effective date.
    </p>

    <h2>10. Contact Us</h2>
    <p>
      If you have any questions or requests regarding this Privacy Policy, please contact us at:<br/>
      <a href="mailto:support@healthscore.app">support@healthscore.app</a>
    </p>

    <p class="updated">Last updated: November 21, 2026</p>
  </div>
</main>
</body>
</html>`;

const TERMS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms &amp; Conditions – ThriveScore Tracker</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
<header>
  <h1>ThriveScore Tracker</h1>
  <p>WCRF/AICR Cancer Prevention Score Calculator</p>
</header>
<main>
  <div class="card">
    <h2>Terms &amp; Conditions <span class="badge">Effective: November 21, 2026</span></h2>
    <p>
      Please read these Terms and Conditions ("Terms") carefully before using the ThriveScore Tracker
      application ("the App") operated by us. By accessing or using the App, you agree to be bound by these Terms.
      If you disagree with any part of these Terms, you may not use the App.
    </p>

    <h2>1. Acceptance of Terms</h2>
    <p>
      By creating an account or using ThriveScore Tracker in any way, you confirm that you are at least
      13 years of age, have read and understood these Terms, and agree to be legally bound by them.
    </p>

    <h2>2. Description of Service</h2>
    <p>
      ThriveScore Tracker is a health and wellness application that helps users calculate their weekly
      WCRF/AICR Cancer Prevention Score based on lifestyle, activity, body metrics, and questionnaire data.
      The App offers optional integration with the Google Health API to sync activity and body measurements.
    </p>

    <h2>3. Not Medical Advice</h2>
    <div class="highlight">
      ThriveScore Tracker is for <strong>informational and educational purposes only</strong>. The content
      provided — including scores, recommendations, and data — does not constitute medical advice, diagnosis,
      or treatment. Always consult a qualified healthcare professional before making any changes to your
      diet, exercise, or health routine.
    </div>

    <h2>4. User Accounts</h2>
    <p>To use the App, you must create an account. You agree to:</p>
    <ul>
      <li>Provide accurate and complete registration information.</li>
      <li>Keep your password secure and confidential.</li>
      <li>Notify us immediately of any unauthorized use of your account.</li>
      <li>Be responsible for all activity that occurs under your account.</li>
    </ul>
    <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>

    <h2>5. Google Health Integration</h2>
    <p>
      The App offers optional integration with the Google Health API via OAuth 2.0. By connecting your Google account, you:
    </p>
    <ul>
      <li>Authorize us to read your selected Google Health activity (steps, active minutes, Active Zone Minutes) and body measurement (weight, height) data.</li>
      <li>Acknowledge that your Google Health data is governed by Google's own Terms of Service and Privacy Policy.</li>
      <li>Understand you can disconnect inside the App or revoke access at any time at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</li>
    </ul>

    <h2>6. Acceptable Use</h2>
    <p>You agree not to use the App to:</p>
    <ul>
      <li>Violate any applicable laws or regulations.</li>
      <li>Attempt to gain unauthorized access to the App's systems or other users' data.</li>
      <li>Transmit malicious code, viruses, or harmful data.</li>
      <li>Use the App for any commercial purpose without our prior written consent.</li>
      <li>Reverse engineer, decompile, or attempt to extract the source code of the App.</li>
    </ul>

    <h2>7. Health Data &amp; User Responsibility</h2>
    <p>
      You are responsible for the accuracy of the health data you enter into the App. Inaccurate data
      will result in inaccurate scores and recommendations. We are not liable for any outcomes resulting
      from incorrect data input or misinterpretation of your scores.
    </p>

    <h2>8. Intellectual Property</h2>
    <p>
      All content, design, logos, and features of the App are the intellectual property of ThriveScore Tracker.
      The WCRF/AICR scoring methodology is based on publicly available research from the World Cancer Research
      Fund and the American Institute for Cancer Research. We do not claim ownership of that research.
    </p>
    <p>You may not copy, reproduce, or distribute any part of the App without our explicit written permission.</p>

    <h2>9. Disclaimer of Warranties</h2>
    <p>
      The App is provided "as is" and "as available" without warranties of any kind, either express or implied.
      We do not warrant that the App will be uninterrupted, error-free, or completely accurate. Use of the
      App is at your own risk.
    </p>

    <h2>10. Limitation of Liability</h2>
    <p>
      To the fullest extent permitted by law, ThriveScore Tracker shall not be liable for any indirect,
      incidental, special, consequential, or punitive damages arising from your use of or inability to use
      the App, including but not limited to loss of data, health outcomes, or personal injury.
    </p>

    <h2>11. Third-Party Services</h2>
    <p>
      The App may integrate with or link to third-party services (including Google Sign-In and the Google Health API). We are
      not responsible for the content, privacy practices, or terms of those services. Your use of
      third-party services is governed by their respective terms and policies.
    </p>

    <h2>12. Termination</h2>
    <p>
      We reserve the right to suspend or terminate your access to the App at any time, with or without
      cause, and with or without notice. Upon termination, your right to use the App ceases immediately.
      You may request deletion of your account and data at any time by contacting us.
    </p>

    <h2>13. Changes to These Terms</h2>
    <p>
      We reserve the right to update these Terms at any time. We will notify users of significant changes
      by updating the effective date at the top of this page. Continued use of the App after changes
      constitutes acceptance of the revised Terms.
    </p>

    <h2>14. Governing Law</h2>
    <p>
      These Terms shall be governed by and construed in accordance with applicable laws. Any disputes
      arising from these Terms or your use of the App shall be resolved through good-faith negotiation,
      and if necessary, through binding arbitration.
    </p>

    <h2>15. Contact Us</h2>
    <p>
      If you have any questions about these Terms, please contact us at:<br/>
      <a href="mailto:support@healthscore.app">support@healthscore.app</a>
    </p>

    <p class="updated">Last updated: November 21, 2026</p>
  </div>
</main>
</body>
</html>`;

router.get(['/privacy-policy', '/privacypolicy.html'], (req, res) => {
  res.type('html').send(PRIVACY_POLICY_HTML);
});

router.get(['/terms-and-conditions', '/terms-and-conditions.html'], (req, res) => {
  res.type('html').send(TERMS_HTML);
});

export default router;
