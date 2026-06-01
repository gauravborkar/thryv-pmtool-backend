// src/services/email.service.ts
import nodemailer from 'nodemailer';

/**
 * Lazily initialize a Nodemailer transporter.
 * If SMTP env vars are provided, they are used.
 * Otherwise, an Ethereal test account is created (no real email sent).
 */
const transporterPromise: Promise<nodemailer.Transporter> = (async () => {
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false otherwise
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log('📧 Using configured SMTP server');
    await transporter.verify();
    return transporter;
  }

  // Fallback to Ethereal (useful for local dev / CI)
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  console.log('📧 Using Ethereal test account. Preview URL will be logged after sending.');
  await transporter.verify();
  return transporter;
})();

/**
 * Generates a polished HTML email body for invitation emails.
 * Uses inline CSS for maximum client compatibility.
 */
const generateInvitationHtml = (invitationUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitation to Thryv PM Tool</title>
  <style>
    body {font-family: Arial, Helvetica, sans-serif; background-color: #f4f7f9; color: #333; padding: 20px;}
    .container {max-width: 600px; margin: auto; background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);}
    .button {display: inline-block; margin-top: 20px; padding: 12px 25px; background-color: #0066ff; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;}
    .footer {margin-top: 30px; font-size: 0.85em; color: #777;}
  </style>
</head>
<body>
  <div class="container">
    <h2>You're Invited!</h2>
    <p>You've been invited to join the <strong>Thryv PM Tool</strong>. Click the button below to accept the invitation.</p>
    <a href="${invitationUrl}" class="button">Accept Invitation</a>
    <p style="margin-top:20px;">If the button doesn’t work, copy and paste the following URL into your browser:</p>
    <p><a href="${invitationUrl}">${invitationUrl}</a></p>
    <p class="footer">The invitation link expires in 7 days. If you didn’t expect this email, you can safely ignore it.</p>
  </div>
</body>
</html>
`;

/**
 * Sends an invitation email to the given address with the invitation token.
 * Throws an error if the email could not be sent.
 */
export const sendInvitationEmail = async (email: string, token: string) => {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const invitationUrl = `${baseUrl}/register?token=${token}&email=${encodeURIComponent(email)}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'no-reply@thryv.com',
    to: email,
    subject: 'You are invited to join Thryv PM Tool',
    html: generateInvitationHtml(invitationUrl),
    text: `You have been invited to join the Thryv PM Tool.\n\nVisit the following link to accept the invitation:\n${invitationUrl}\n\nThe link expires in 7 days.`,
  };

  const transporter = await transporterPromise;
  const info = await transporter.sendMail(mailOptions);
  console.log('📧 Invitation email sent (messageId=%s) to %s', info.messageId, email);
  // If using Ethereal, output a preview URL for quick debugging
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) {
    console.log('🔍 Preview URL:', preview);
  }
};
