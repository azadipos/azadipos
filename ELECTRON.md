# Running the app inside Electron

Development

- Install deps:

```bash
pnpm install
# or npm install / yarn
```

- Run Next.js in dev and open Electron:

```bash
pnpm run electron:dev
```

This runs `next dev` and then starts Electron after the dev server is available.

Production (build)

- Build Next.js and package with electron-builder:

```bash
pnpm run electron:build
```

Notes
- This scaffolding launches a Next.js server inside the packaged app (so API routes continue to work).
- For further hardening (automatic updates, code signing), update `package.json` `build` config and `electron/main.js` as needed.

Windows-specific notes

- Icon: Place a Windows icon at `public/icon.ico` (recommended size 256x256). `electron-builder` will include it in the installer.

- Building on macOS: To produce Windows installers on macOS you need `wine` and other cross-build tooling, or use a CI runner that builds on Windows. If you don't have wine, consider building on a Windows machine or using GitHub Actions with `electron-builder`.

- Create a signed build (recommended for Windows distribution) by configuring code signing certificates and adding the relevant `win`/`nsig` signing options to `package.json` or environment variables.

Windows build command

```bash
# Builds Next.js and packages a Windows installer
pnpm install
pnpm run electron:build
```

CI build (recommended)

To produce Windows installers automatically, use the included GitHub Actions workflow `.github/workflows/windows-build.yml`. Push to `main` (or run workflow_dispatch) and the job will run on `windows-latest`, build the app and upload installers as workflow artifacts.

Secrets & signing

If you want signed Windows installers, configure code signing in `package.json` or pass signing credentials via repository secrets (see `electron-builder` docs). On GitHub Actions set the relevant secrets and add signing env vars to the workflow.
