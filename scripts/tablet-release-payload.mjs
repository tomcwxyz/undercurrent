import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const apkPath = process.argv[2] ?? "swells-tablet-shell-debug.apk";
const outputPath = process.argv[3] ?? "tablet-release.json";
const assetPrefix = process.argv[4] ?? "swells-tablet";
const buildFile = readFileSync("apps/tablet-shell/app/build.gradle.kts", "utf8");

const versionCode = Number(buildFile.match(/versionCode\s*=\s*(\d+)/)?.[1]);
const versionName = buildFile.match(/versionName\s*=\s*"([^"]+)"/)?.[1];
if (!Number.isInteger(versionCode) || !versionName) {
  throw new Error("Could not read tablet versionCode/versionName");
}

const apk = readFileSync(apkPath);
const sha256 = createHash("sha256").update(apk).digest("hex");
const payload = {
  versionCode,
  versionName,
  sha256,
  apkSize: apk.length,
  assetName: `${assetPrefix}-${versionCode}.apk`,
  gitSha: process.env.GITHUB_SHA?.trim() || "local",
  required: false,
};

writeFileSync(outputPath, JSON.stringify(payload));
console.log(`Prepared tablet ${versionName} (versionCode ${versionCode}, ${apk.length} bytes, ${sha256.slice(0, 12)}…)`);
