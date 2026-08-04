type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  bcc?: string;
  replyTo?: string;
  logContext?: Record<string, unknown>;
};

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  bcc,
  replyTo,
  logContext,
}: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY missing. Skipping email.", logContext);
    return false;
  }

  const from =
    process.env.RESEND_FROM_EMAIL || process.env.ORDER_EMAIL_FROM || process.env.AUTH_EMAIL_FROM;
  if (!from) {
    console.warn("[email] RESEND_FROM_EMAIL missing. Skipping email.", logContext);
    return false;
  }

  const defaultBcc = process.env.ORDER_EMAIL_BCC;
  const defaultReplyTo = process.env.ORDER_EMAIL_REPLY_TO;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      ...(bcc || defaultBcc ? { bcc: bcc ?? defaultBcc } : {}),
      ...(replyTo || defaultReplyTo ? { reply_to: replyTo ?? defaultReplyTo } : {}),
      subject,
      html,
    }),
  });

  if (!response.ok) {
    console.error("[email] send failed", {
      ...logContext,
      status: response.status,
      body: await response.text(),
    });
    return false;
  }

  console.info("[email] sent", { ...logContext, to, subject });
  return true;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
