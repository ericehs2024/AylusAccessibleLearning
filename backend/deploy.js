const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const backendDir = __dirname;
  const projectRoot = path.join(backendDir, '..');
  const frontendDir = path.join(projectRoot, 'frontend');
  const distSrc = path.join(frontendDir, 'dist');
  const distDest = path.join(backendDir, 'dist');
  const zipPath = path.join(backendDir, 'deploy.zip');
  const staging = path.join(projectRoot, 'deploy_staging');

  console.log('==> Building frontend...');
  execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

  if (!fs.existsSync(distSrc)) {
    console.error('frontend/dist not found after build');
    process.exit(1);
  }

  console.log('==> Copying frontend/dist -> backend/dist...');
  if (fs.existsSync(distDest)) fs.rmSync(distDest, { recursive: true, force: true });
  fs.cpSync(distSrc, distDest, { recursive: true });

  console.log('==> Creating deploy.zip in backend/ (including .env, excluding .env.local)...');

  // prepare staging to control exactly what goes into zip
  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  fs.mkdirSync(path.join(staging, 'dist'), { recursive: true });

  // copy backend files (exclude node_modules, uploads, deploy.zip, .env.local)
  const backendFiles = fs.readdirSync(backendDir);
  for (const name of backendFiles) {
    if (['node_modules', 'uploads', 'deploy.zip', 'dist', '.git', '.env.local'].includes(name)) continue;
    const src = path.join(backendDir, name);
    const dest = path.join(staging, name);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) fs.cpSync(src, dest, { recursive: true });
    else fs.copyFileSync(src, dest);
  }
  // include .env (production) only - .env.local is local dev and must not be deployed
  const envPath = path.join(backendDir, '.env');
  if (fs.existsSync(envPath)) fs.copyFileSync(envPath, path.join(staging, '.env'));
  // copy dist
  fs.cpSync(distDest, path.join(staging, 'dist'), { recursive: true });

  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  // use PowerShell on Windows, zip on Unix
  try {
    if (process.platform === 'win32') {
      execSync(`powershell -Command "Compress-Archive -Path '${staging}/*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
    } else {
      execSync(`cd "${staging}" && zip -r "${zipPath}" . -q`, { stdio: 'inherit' });
    }
  } finally {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  }

  if (!fs.existsSync(zipPath)) {
    console.error('Failed to create deploy.zip');
    process.exit(1);
  }
  const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
  console.log(`Done: backend/deploy.zip (${sizeMb} MB)`);
  console.log('Contents: backend + .env + dist/ (frontend build) - .env.local excluded');
  console.log('Upload backend/deploy.zip to Hostinger File Manager and Extract to your Node.js app root');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
