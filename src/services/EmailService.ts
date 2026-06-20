import nodemailer, { Transporter } from 'nodemailer';

/**
 * Sends transactional email (currently: address-verification messages) via SMTP.
 *
 * If SMTP is not configured (no SMTP_HOST), the service runs in "console" mode:
 * it logs the verification link instead of sending, so the flow is fully
 * testable in development before real SMTP credentials are supplied. See
 * docs/authentication.md and docs/configuration.md.
 */
export class EmailService {
  private transporter: Transporter | null;
  private from: string;
  private appUrl: string;

  constructor() {
    this.from = process.env.EMAIL_FROM || 'Kilimo AI <no-reply@kilimo.ai>';
    this.appUrl = (process.env.APP_URL || 'http://localhost:4000').replace(/\/$/, '');

    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        // `secure` true for port 465 (implicit TLS); false uses STARTTLS.
        secure: process.env.SMTP_SECURE === 'true',
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  /** True when real SMTP delivery is configured. */
  get isLive(): boolean {
    return this.transporter !== null;
  }

  /** Builds the link a user clicks (or the API GET route hits) to verify. */
  verificationUrl(token: string): string {
    return `${this.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const url = this.verificationUrl(token);

    if (!this.transporter) {
      // Dev fallback: no SMTP configured — surface the link so testing works.
      console.log(`\n[EmailService] SMTP not configured. Verify ${to} at:\n  ${url}\n`);
      return;
    }

    const safeName = name || 'there';
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Verify your Kilimo AI email',
      text:
        `Hi ${safeName},\n\n` +
        `Confirm your email address to activate your Kilimo AI account:\n${url}\n\n` +
        `This link expires in 24 hours. If you did not sign up, ignore this email.`,
      html:
        `<p>Hi ${escapeHtml(safeName)},</p>` +
        `<p>Confirm your email address to activate your Kilimo AI account:</p>` +
        `<p><a href="${url}">Verify my email</a></p>` +
        `<p>This link expires in 24 hours. If you did not sign up, you can ignore this email.</p>`,
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
