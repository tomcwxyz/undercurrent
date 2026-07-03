import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { setEmailDigestPreference } from "@/lib/db/queries";

function page(title: string, bodyHtml: string): NextResponse {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Swells</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0E1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#E8E4DF;">
  <div style="max-width:420px;padding:2rem;text-align:center;">
    <p style="font-style:italic;font-size:1.2rem;margin-bottom:1.5rem;background:linear-gradient(90deg,#4ECDC4,#6C5CE7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">swells</p>
    <h1 style="font-size:1.3rem;font-weight:400;margin-bottom:0.75rem;">${title}</h1>
    ${bodyHtml}
  </div>
</body>
</html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function errorPage(): NextResponse {
  return page(
    "Link not valid",
    `<p style="color:#9A9691;font-size:0.9rem;line-height:1.5;">This unsubscribe link is invalid or has expired.</p>`
  );
}

// GET renders a confirmation page rather than unsubscribing immediately —
// email security scanners and link-prefetchers auto-GET links in message
// bodies, which would otherwise silently unsubscribe someone who never
// clicked anything. The actual mutation only happens on the POST below,
// triggered by a real click on the confirm button.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const spaceId = req.nextUrl.searchParams.get("spaceId");
  const token = req.nextUrl.searchParams.get("token");

  if (!userId || !spaceId || !token || !verifyUnsubscribeToken(userId, spaceId, token)) {
    return errorPage();
  }

  return page(
    "Unsubscribe from this digest?",
    `<p style="color:#9A9691;font-size:0.9rem;line-height:1.5;margin-bottom:1.5rem;">You'll stop getting the weekly email digest for this space. You can turn it back on any time from the space settings.</p>
    <form method="POST">
      <input type="hidden" name="userId" value="${userId}" />
      <input type="hidden" name="spaceId" value="${spaceId}" />
      <input type="hidden" name="token" value="${token}" />
      <button type="submit" style="background:linear-gradient(90deg,#4ECDC4,#6C5CE7);color:#0A0E1A;border:none;border-radius:20px;padding:10px 24px;font-size:0.85rem;font-weight:500;cursor:pointer;">Confirm unsubscribe</button>
    </form>`
  );
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const userId = form.get("userId");
  const spaceId = form.get("spaceId");
  const token = form.get("token");

  if (
    typeof userId !== "string" ||
    typeof spaceId !== "string" ||
    typeof token !== "string" ||
    !verifyUnsubscribeToken(userId, spaceId, token)
  ) {
    return errorPage();
  }

  await setEmailDigestPreference(userId, spaceId, false);

  return page(
    "You're unsubscribed",
    `<p style="color:#9A9691;font-size:0.9rem;line-height:1.5;">You won't get the weekly email digest for this space anymore. You can turn it back on any time from the space settings.</p>`
  );
}
