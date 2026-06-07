export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// GET: Return current version info
export async function GET() {
  try {
    // Read version from package.json
    const pkgPath = path.join(process.cwd(), "package.json");
    let version = "1.0.0";
    let lastUpdate = null;

    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      version = pkg.version || "1.0.0";
    }

    // Check for update history file
    const historyPath = path.join(process.cwd(), ".update-history.json");
    let updateHistory: any[] = [];
    if (fs.existsSync(historyPath)) {
      try {
        updateHistory = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
        if (updateHistory.length > 0) {
          lastUpdate = updateHistory[updateHistory.length - 1];
        }
      } catch {
        // ignore parse errors
      }
    }

    return NextResponse.json({
      version,
      lastUpdate,
      updateHistory: updateHistory.slice(-10), // Last 10 updates
      platform: typeof window !== "undefined" ? "web" : "server",
    });
  } catch (error) {
    console.error("Error getting version info:", error);
    return NextResponse.json(
      { error: "Failed to get version info" },
      { status: 500 }
    );
  }
}

// POST: Apply an update from an uploaded zip/patch file
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("updateFile") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No update file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".zip") && !fileName.endsWith(".azupdate")) {
      return NextResponse.json(
        { error: "Invalid file type. Please provide a .zip or .azupdate file" },
        { status: 400 }
      );
    }

    // Save the uploaded file to a temp location
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tmpDir = path.join(process.cwd(), ".updates");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpPath = path.join(tmpDir, file.name);
    fs.writeFileSync(tmpPath, buffer);

    // Extract and apply the update
    const { execSync } = require("child_process");
    const extractDir = path.join(tmpDir, "extracted");

    // Clean previous extraction
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });

    // Extract the zip
    try {
      execSync(`unzip -o "${tmpPath}" -d "${extractDir}"`, {
        stdio: "pipe",
        timeout: 60000,
      });
    } catch (unzipErr: any) {
      // Try with PowerShell on Windows
      try {
        execSync(
          `powershell -Command "Expand-Archive -Path '${tmpPath}' -DestinationPath '${extractDir}' -Force"`,
          { stdio: "pipe", timeout: 60000 }
        );
      } catch {
        return NextResponse.json(
          { error: "Failed to extract update file. Ensure it is a valid zip archive." },
          { status: 400 }
        );
      }
    }

    // Check for update manifest
    const manifestPath = path.join(extractDir, "update-manifest.json");
    let manifest: any = null;
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }

    // Apply the update files
    const appRoot = process.cwd();
    const updateSourceDir = manifest?.sourceDir
      ? path.join(extractDir, manifest.sourceDir)
      : extractDir;

    // Get list of files in the update
    const updatedFiles: string[] = [];
    const copyRecursive = (src: string, dest: string, basePath: string) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        const relPath = path.relative(basePath, srcPath);

        // Skip update-specific files and dangerous directories
        if (
          entry.name === "update-manifest.json" ||
          entry.name === ".updates" ||
          entry.name === "node_modules" ||
          entry.name === ".next" ||
          entry.name === ".build" ||
          entry.name === ".git" ||
          entry.name === ".env" ||
          entry.name === "prisma" ||
          entry.name === ".update-history.json"
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          copyRecursive(srcPath, destPath, basePath);
        } else {
          // Create directory if needed
          const dir = path.dirname(destPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.copyFileSync(srcPath, destPath);
          updatedFiles.push(relPath);
        }
      }
    };

    copyRecursive(updateSourceDir, appRoot, updateSourceDir);

    // Record update in history
    const historyPath = path.join(appRoot, ".update-history.json");
    let history: any[] = [];
    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
      } catch {
        history = [];
      }
    }

    const updateRecord = {
      timestamp: new Date().toISOString(),
      fileName: file.name,
      version: manifest?.version || "unknown",
      description: manifest?.description || "Manual update",
      filesUpdated: updatedFiles.length,
      files: updatedFiles.slice(0, 50), // Store first 50 file names
    };

    history.push(updateRecord);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

    // Clean up
    try {
      fs.rmSync(tmpPath);
      fs.rmSync(extractDir, { recursive: true });
    } catch {
      // non-critical cleanup
    }

    return NextResponse.json({
      success: true,
      filesUpdated: updatedFiles.length,
      version: manifest?.version || "unknown",
      description: manifest?.description || "Manual update",
      message: `Update applied successfully. ${updatedFiles.length} file(s) updated. Please restart the application for changes to take effect.`,
      requiresRestart: true,
    });
  } catch (error: any) {
    console.error("Error applying update:", error);
    return NextResponse.json(
      { error: `Failed to apply update: ${error.message}` },
      { status: 500 }
    );
  }
}
