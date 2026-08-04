import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path: string) => readFileSync(join(projectRoot, path), "utf8");
const fail = (message: string): never => {
  console.error(`Release check failed: ${message}`);
  process.exit(1);
};

const packageVersion = JSON.parse(read("package.json")).version as string;
const gradle = read("android/app/build.gradle");
const fdroid = read(".fdroid.yml");
const versionName = gradle.match(/versionName\s+["']([^"']+)["']/)?.[1];
const versionCodeText = gradle.match(/versionCode\s+(\d+)/)?.[1];

if (!/^\d+\.\d+\.\d+$/.test(packageVersion))
  fail(`package.json has an invalid version: ${packageVersion}`);
if (!versionName || !versionCodeText)
  fail("Android versionName or versionCode is missing");
if (versionName !== packageVersion)
  fail(`package.json is ${packageVersion}, but Android is ${versionName}`);

const versionCode = Number(versionCodeText);
if (!Number.isSafeInteger(versionCode) || versionCode < 1)
  fail(`Android versionCode is invalid: ${versionCodeText}`);

const currentVersion = fdroid.match(/^CurrentVersion:\s*(\S+)$/m)?.[1];
const currentVersionCode = fdroid.match(/^CurrentVersionCode:\s*(\d+)$/m)?.[1];
if (currentVersion !== versionName || currentVersionCode !== versionCodeText) {
  fail(
    `.fdroid.yml must declare CurrentVersion ${versionName} and CurrentVersionCode ${versionCode}`,
  );
}

const fdroidBuildVersion = fdroid.match(/^\s+- versionName:\s*(\S+)$/m)?.[1];
const fdroidBuildCode = fdroid.match(/^\s+versionCode:\s*(\d+)$/m)?.[1];
const fdroidCommit = fdroid.match(/^\s+commit:\s*(\S+)$/m)?.[1];
if (
  fdroidBuildVersion !== versionName ||
  fdroidBuildCode !== versionCodeText ||
  fdroidCommit !== versionName
) {
  fail(
    `.fdroid.yml build must use version ${versionName}, code ${versionCode}, and commit ${versionName}`,
  );
}

const changelog = `fastlane/metadata/android/en-US/changelogs/${versionCode}.txt`;
if (!existsSync(join(projectRoot, changelog))) fail(`${changelog} is missing`);

const metadataRoot = "fastlane/metadata/android/en-US";
const metadataLimits = [
  ["title.txt", 50],
  ["short_description.txt", 80],
  ["full_description.txt", 4000],
  [`changelogs/${versionCode}.txt`, 500],
] as const;
for (const [path, maxLength] of metadataLimits) {
  const contents = read(`${metadataRoot}/${path}`).trim();
  if (!contents) fail(`${metadataRoot}/${path} is empty`);
  if (contents.length > maxLength)
    fail(`${metadataRoot}/${path} exceeds ${maxLength} characters`);
}

const icon = join(projectRoot, metadataRoot, "images/icon.png");
const screenshots = join(projectRoot, metadataRoot, "images/phoneScreenshots");
if (!existsSync(icon)) fail(`${metadataRoot}/images/icon.png is missing`);
if (
  !existsSync(screenshots) ||
  !readdirSync(screenshots).some((path) => /\.(png|jpe?g)$/i.test(path))
) {
  fail(`${metadataRoot}/images/phoneScreenshots needs at least one screenshot`);
}

const releaseTag = process.argv[2]?.replace(/^v/, "");
if (releaseTag && releaseTag !== versionName)
  fail(`tag ${process.argv[2]} does not match version ${versionName}`);

console.log(`Pulse ${versionName} (${versionCode}) is release-ready.`);
