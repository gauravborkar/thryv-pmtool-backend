// scripts/send-test-email.ts
import dotenv from 'dotenv';
dotenv.config();

import { sendInvitationEmail } from '../src/services/email.service';

const testEmail = process.env.TEST_EMAIL;
if (!testEmail) {
  console.error('❌ Please set TEST_EMAIL in .env');
  process.exit(1);
}

(async () => {
  try {
    // Use a dummy token for test
    const dummyToken = 'test-token';
    await sendInvitationEmail(testEmail, dummyToken);
    console.log('✅ Test invitation email sent to', testEmail);
  } catch (err) {
    console.error('❌ Failed to send test email:', err);
    process.exit(1);
  }
})();
