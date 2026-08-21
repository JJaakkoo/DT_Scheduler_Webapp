import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, name: string, otp: string) {
  return await resend.emails.send({
    from: 'Dream Tea Nexus <no-reply@dreamteanexus.ca>',
    to: [email],
    subject: 'Verify your Dream Tea Nexus Account',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${name},</h2>
        <p>You requested to link your account to the Dream Tea Nexus portal.</p>
        <p>Your verification code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px; color: #628ebf;">${otp}</h1>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
}
