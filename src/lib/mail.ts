import { env } from "./env";

type Mail = { to: string; subject: string; text: string };

/** Whether mail really goes out; otherwise it is printed to the server console. */
export const emailConfigured = () => Boolean(env.RESEND_API_KEY);

/**
 * Send an email through Resend when RESEND_API_KEY is set; otherwise print it to the server console
 * (development: copy the link from the terminal).
 */
export async function sendMail(mail: Mail) {
  if (!env.RESEND_API_KEY) {
    console.info(`\n[mail] To: ${mail.to}\n[mail] Subject: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status} ${await res.text()}`);
}
