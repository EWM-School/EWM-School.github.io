import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const pkgPath = path.join(rootDir, 'package.json');
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');

const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgRaw);

const parts = String(pkg.version || '1.2.0')
  .trim()
  .split('.')
  .map((n) => Number.parseInt(n, 10) || 0);

const major = parts[0] ?? 1;
const minor = parts[1] ?? 2;
const nextPatch = (parts[2] ?? 0) + 1;
const nextVersion = `${major}.${minor}.${nextPatch}`;

pkg.version = nextVersion;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

let nextVersionCode = 1;
if (fs.existsSync(gradlePath)) {
  let gradleContent = fs.readFileSync(gradlePath, 'utf8');
  const codeMatch = gradleContent.match(/versionCode\s+(\d+)/);
  nextVersionCode = codeMatch ? Number.parseInt(codeMatch[1], 10) + 1 : 4;

  gradleContent = gradleContent
    .replace(/versionCode\s+\d+/, `versionCode ${nextVersionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${nextVersion}"`);

  fs.writeFileSync(gradlePath, gradleContent, 'utf8');
}

console.log(`Bumped semantic version -> v${nextVersion} (Android versionCode ${nextVersionCode})`);

if (process.env.GITHUB_ENV) {
  fs.appendFileSync(
    process.env.GITHUB_ENV,
    `NEXT_VERSION=${nextVersion}\nNEXT_VERSION_CODE=${nextVersionCode}\n`,
    'utf8'
  );
}
