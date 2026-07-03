interface AttentionShift {
  from: string;
  to: string;
  significance: string;
}

interface DigestParams {
  spaceName: string;
  dominantThemes: string[];
  absentThemes: string[];
  attentionShifts: AttentionShift[];
  metaReflectionPrompt: string;
  signalCount: number;
  observationCount: number;
  appUrl: string;
  unsubscribeUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function themeChips(themes: string[]): string {
  if (themes.length === 0) return `<p style="color:#9A9691;font-size:0.85rem;">None noted this week.</p>`;
  return `<p style="line-height:2;">${themes
    .map(
      (t) =>
        `<span style="display:inline-block;background:rgba(78,205,196,0.12);color:#4ECDC4;border-radius:8px;padding:3px 10px;margin:0 6px 6px 0;font-size:0.8rem;">${escapeHtml(t)}</span>`
    )
    .join("")}</p>`;
}

/**
 * Builds the weekly attention-analysis digest email. Plain HTML string
 * (no react-email — not an existing dependency, not worth adding for one
 * template) sent via Resend's `html` field.
 */
export function buildDigestEmail(params: DigestParams): { subject: string; html: string } {
  const {
    spaceName,
    dominantThemes,
    absentThemes,
    attentionShifts,
    metaReflectionPrompt,
    signalCount,
    observationCount,
    appUrl,
    unsubscribeUrl,
  } = params;

  const shiftsHtml = attentionShifts.length
    ? attentionShifts
        .slice(0, 3)
        .map(
          (s) =>
            `<li style="margin-bottom:6px;">${escapeHtml(s.from)} &rarr; ${escapeHtml(s.to)} <span style="color:#9A9691;">— ${escapeHtml(s.significance)}</span></li>`
        )
        .join("")
    : `<li style="color:#9A9691;">No notable shifts this week.</li>`;

  const subject = `This week's attention: ${dominantThemes.slice(0, 2).join(", ") || spaceName}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;background:#0A0E1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#E8E4DF;">
  <div style="max-width:560px;margin:0 auto;padding:2.5rem 1.5rem;">
    <p style="font-style:italic;font-size:1.2rem;margin:0 0 2rem;background:linear-gradient(90deg,#4ECDC4,#6C5CE7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">swells</p>

    <p style="text-transform:uppercase;letter-spacing:0.08em;font-size:0.72rem;color:#9A9691;margin:0 0 0.5rem;">${escapeHtml(spaceName)} · this week</p>
    <h1 style="font-size:1.5rem;font-weight:300;line-height:1.3;margin:0 0 1.5rem;">What your team has been noticing</h1>

    <p style="color:#9A9691;font-size:0.85rem;margin:0 0 1.5rem;">${observationCount} observation${observationCount === 1 ? "" : "s"} · ${signalCount} signal${signalCount === 1 ? "" : "s"}</p>

    <h2 style="font-size:0.95rem;font-weight:500;margin:0 0 0.5rem;">Dominant themes</h2>
    ${themeChips(dominantThemes)}

    <h2 style="font-size:0.95rem;font-weight:500;margin:1.5rem 0 0.5rem;">Conspicuously absent</h2>
    ${themeChips(absentThemes)}

    <h2 style="font-size:0.95rem;font-weight:500;margin:1.5rem 0 0.5rem;">Attention shifts</h2>
    <ul style="margin:0;padding-left:1.2rem;font-size:0.85rem;line-height:1.6;">${shiftsHtml}</ul>

    <div style="margin:2rem 0;padding:1.25rem;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.02);">
      <p style="margin:0;font-style:italic;font-size:0.95rem;line-height:1.5;">${escapeHtml(metaReflectionPrompt)}</p>
    </div>

    <a href="${appUrl}/reflect" style="display:inline-block;background:linear-gradient(90deg,#4ECDC4,#6C5CE7);color:#0A0E1A;text-decoration:none;padding:10px 20px;border-radius:20px;font-size:0.85rem;font-weight:500;">Reflect on this &rarr;</a>

    <p style="margin-top:3rem;font-size:0.72rem;color:#5C5850;">
      You're getting this because you're a member of ${escapeHtml(spaceName)} on Swells.
      <a href="${unsubscribeUrl}" style="color:#5C5850;">Unsubscribe from this space's digest</a>.
    </p>
  </div>
</body>
</html>`;

  return { subject, html };
}
