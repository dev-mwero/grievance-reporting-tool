import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send an email. Returns false when SMTP is not configured so callers can
 * fall back to logging the action link (development behaviour).
 */
async function sendMail(input: MailInput): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  await t.sendMail({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return true;
}

function layout(
  title: string,
  body: string,
  cta?: { label: string; url: string },
) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#171717">
    <h2 style="color:#0f766e">${title}</h2>
    <div style="line-height:1.6">${body}</div>
    ${
      cta
        ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${cta.label}</a></p>
           <p style="color:#666;font-size:13px;word-break:break-all">Or copy this link: ${cta.url}</p>`
        : ""
    }
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
    <p style="color:#888;font-size:12px">Grievance Management System</p>
  </div>`;
}

export async function sendPasswordResetEmail(email: string, rawToken: string) {
  const url = `${env.APP_URL}/reset-password?token=${rawToken}`;
  const sent = await sendMail({
    to: email,
    subject: "Reset your password",
    text: `Reset your password using this link: ${url}`,
    html: layout(
      "Reset your password",
      "<p>We received a request to reset your password. This link expires in 1 hour.</p>",
      { label: "Reset password", url },
    ),
  });
  if (!sent) {
    console.log(`[PASSWORD RESET] Token for ${email}: ${rawToken}`);
  }
  return sent;
}

export async function sendInvitationEmail(
  email: string,
  name: string,
  rawToken: string,
) {
  const url = `${env.APP_URL}/accept-invitation?token=${rawToken}`;
  const sent = await sendMail({
    to: email,
    subject: "You have been invited",
    text: `Accept your invitation using this link: ${url}`,
    html: layout(
      `Welcome, ${name}`,
      "<p>You have been invited to join the Grievance Management System. This link expires in 7 days.</p>",
      { label: "Accept invitation", url },
    ),
  });
  if (!sent) {
    console.log(`[INVITATION] Token for ${email}: ${rawToken}`);
  }
  return sent;
}
