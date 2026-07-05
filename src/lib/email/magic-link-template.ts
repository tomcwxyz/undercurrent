interface MagicLinkParams {
  url: string;
  host: string;
}

/**
 * Branded replacement for next-auth's default magic-link email (which ships
 * plain black-on-white HTML). Mirrors the digest email's styling — see
 * digest-template.ts — so the two emails read as the same product.
 */
export function buildMagicLinkEmail({ url, host }: MagicLinkParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Sign in to Swells`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;background:#0A0E1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#E8E4DF;">
  <div style="max-width:480px;margin:0 auto;padding:2.5rem 1.5rem;">
    <p style="font-style:italic;font-size:1.2rem;margin:0 0 2rem;background:linear-gradient(90deg,#4ECDC4,#6C5CE7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">swells</p>

    <h1 style="font-size:1.4rem;font-weight:300;line-height:1.3;margin:0 0 0.75rem;">Sign in to your account</h1>
    <p style="color:#9A9691;font-size:0.88rem;line-height:1.5;margin:0 0 2rem;">
      Click the button below to sign in to Swells on <strong style="color:#E8E4DF;">${host}</strong>. This link expires in 24 hours and can only be used once.
    </p>

    <a href="${url}" style="display:inline-block;background:linear-gradient(90deg,#4ECDC4,#6C5CE7);color:#0A0E1A;text-decoration:none;padding:11px 22px;border-radius:20px;font-size:0.88rem;font-weight:500;">Sign in &rarr;</a>

    <p style="margin-top:2.5rem;font-size:0.78rem;color:#5C5850;line-height:1.5;">
      If the button doesn't work, copy and paste this link into your browser:<br />
      <a href="${url}" style="color:#4ECDC4;word-break:break-all;">${url}</a>
    </p>

    <p style="margin-top:2rem;font-size:0.72rem;color:#5C5850;">
      If you didn't request this email, you can safely ignore it.
    </p>
  </div>
</body>
</html>`;

  const text = `Sign in to Swells\n\nClick this link to sign in to ${host}:\n${url}\n\nThis link expires in 24 hours and can only be used once. If you didn't request this email, you can safely ignore it.`;

  return { subject, html, text };
}
