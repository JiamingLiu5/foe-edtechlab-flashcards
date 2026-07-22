import nodemailer from "nodemailer";
import { env } from "../../env.js";

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

export async function sendMagicLinkEmail(email: string, link: string): Promise<void> {
  if (!transporter) {
    // No SMTP configured: log so the tool is usable without mail setup during
    // prototype/dev deployment. Configure SMTP_HOST for real delivery.
    console.log(`[magic-link] SMTP not configured. Login link for ${email}:\n${link}`);
    return;
  }

  await transporter.sendMail({
    from: env.smtp.from,
    to: email,
    subject: "Your Flashcards sign-in link",
    text: `Click to sign in: ${link}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`,
    html: `<p><a href="${link}">Click to sign in</a></p><p>This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`,
  });
}
