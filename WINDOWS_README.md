Goal

Produce a single Windows installer (NSIS) you can download and run on your Windows PC.

Options (pick one)

1) CI build (recommended — no local Windows machine required)
- Push this repo to GitHub. The included workflow `.github/workflows/windows-build.yml` runs on `windows-latest`, builds the app and uploads the installer artifacts.
- After the workflow completes, download the `windows-installers` artifact from the workflow run and run the `.exe` or `.zip` on Windows.

Steps to use CI build:

```bash
# 1. Commit & push all changes to GitHub (main branch)
git add .
git commit -m "Add electron windows build"
git push origin main

# 2. Open GitHub > Actions > Build Windows installer and wait for job to finish
# 3. Download artifact from the successful run (windows-installers)
```

Signing: If you want a signed installer, configure code signing credentials (certificate) and add the required environment variables or `package.json` signing config. See `electron-builder` docs.

2) Local Windows build (if you have Windows)

Prerequisites: Node 20+, npm (or pnpm), Git, Windows build environment.

Commands to run on Windows (in project root):

```powershell
# install deps
npm ci

# build Next.js and package the app
npm run electron:build
```

Output: `dist/` will contain installer(s) and portable builds.

Notes
- If you'd like, I can (A) add a placeholder `public/icon.ico` for a branded installer icon, (B) enable code signing hooks, or (C) attempt to trigger a workflow run if you give me repo access. Tell me which.