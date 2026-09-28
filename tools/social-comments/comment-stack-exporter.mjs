#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

function usage() {
  console.log(`Comment Stack Studio transparent exporter

Usage:
  node comment-stack-exporter.mjs [options]

Options:
  --project FILE    Project JSON exported by Comment Stack Studio
  --output FILE     Output ProRes 4444 file (default: comment-stack-alpha.mov)
  --html FILE       Studio HTML file (default: beside this script)
  --fps NUMBER      Frame rate (default: 23.976)
  --hold SECONDS    Hold the finished composition (default: 1.5)
  --frames DIR      Keep the transparent PNG sequence in this directory
  --encoder MODE    auto, software, or videotoolbox (default: auto)
  --help            Show this help

Examples:
  node comment-stack-exporter.mjs --project my-setup.json --output comments.mov
  node comment-stack-exporter.mjs --project my-setup.json --frames ./comment-frames
`);
}

function parseArgs(argv) {
  const out = { fps: 23.976, hold: 1.5, encoder: "auto" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i];
    else if (arg === "--output") out.output = argv[++i];
    else if (arg === "--html") out.html = argv[++i];
    else if (arg === "--fps") out.fps = Number(argv[++i]);
    else if (arg === "--hold") out.hold = Number(argv[++i]);
    else if (arg === "--frames") out.frames = argv[++i];
    else if (arg === "--encoder") out.encoder = argv[++i];
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isFinite(out.fps) || out.fps <= 0) throw new Error("--fps must be greater than zero");
  if (!Number.isFinite(out.hold) || out.hold < 0) throw new Error("--hold cannot be negative");
  if (!["auto", "software", "videotoolbox"].includes(out.encoder)) throw new Error("--encoder must be auto, software, or videotoolbox");
  return out;
}

async function loadPlaywright() {
  const candidates = [
    "playwright",
    pathToFileURL(join(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs")).href,
  ];
  for (const candidate of candidates) {
    try {
      return await import(candidate);
    } catch {}
  }
  throw new Error("Playwright was not found. Run `npm install playwright` in this folder and try again.");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

function inspect(command, args) {
  return spawnSync(command, args, { encoding: "utf8" });
}

function findBrowserExecutable() {
  const candidates = process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
    : process.platform === "win32"
      ? [
          join(process.env.PROGRAMFILES || "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
          join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google/Chrome/Application/chrome.exe"),
          join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
        ]
      : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"];
  return candidates.find(candidate => candidate && existsSync(candidate));
}

function hasFfmpegEncoder(name) {
  const result = inspect("ffmpeg", ["-hide_banner", "-encoders"]);
  return result.status === 0 && `${result.stdout}${result.stderr}`.includes(name);
}

function testVideoToolboxAlpha(firstFrame, probePath) {
  if (process.platform !== "darwin" || !hasFfmpegEncoder("prores_videotoolbox")) return false;
  const encode = inspect("ffmpeg", [
    "-v", "error", "-y", "-i", firstFrame, "-frames:v", "1",
    "-vf", "format=bgra", "-c:v", "prores_videotoolbox", "-profile:v", "4", "-allow_sw", "0", probePath,
  ]);
  if (encode.status !== 0) return false;
  const probe = inspect("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt", "-of", "default=nw=1:nk=1", probePath]);
  return probe.status === 0 && probe.stdout.trim().startsWith("yuva");
}

function chooseEncoder(mode, frameDir) {
  if (mode === "software") return { name: "software ProRes", args: ["-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuva444p10le", "-alpha_bits", "16", "-vendor", "apl0"] };
  const probePath = join(frameDir, ".videotoolbox-alpha-probe.mov");
  const supported = testVideoToolboxAlpha(join(frameDir, "frame-000000.png"), probePath);
  if (existsSync(probePath)) rmSync(probePath, { force: true });
  if (supported) return { name: "Apple VideoToolbox ProRes hardware", args: ["-vf", "format=bgra", "-c:v", "prores_videotoolbox", "-profile:v", "4", "-allow_sw", "0"] };
  if (mode === "videotoolbox") throw new Error("VideoToolbox ProRes 4444 alpha is not supported by this Mac. Use --encoder software or --encoder auto.");
  return { name: "software ProRes (hardware ProRes alpha unavailable)", args: ["-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuva444p10le", "-alpha_bits", "16", "-vendor", "apl0"] };
}

function ffmpegRate(fps) {
  return Math.abs(fps - 23.976) < 0.01 ? "24000/1001" : String(fps);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();

  console.log(`Guide: ${join(SCRIPT_DIR, "EXPORTING.md")}`);

  const htmlPath = resolve(args.html || join(SCRIPT_DIR, "index.html"));
  const outputPath = resolve(args.output || "comment-stack-alpha.mov");
  const project = args.project ? JSON.parse(readFileSync(resolve(args.project), "utf8")) : {};
  if (!existsSync(htmlPath)) throw new Error(`Studio HTML not found: ${htmlPath}`);

  const temporaryFrames = !args.frames;
  const frameDir = args.frames ? resolve(args.frames) : mkdtempSync(join(tmpdir(), "gc-comment-stack-"));
  mkdirSync(frameDir, { recursive: true });

  const { chromium } = await loadPlaywright();
  const chromePath = findBrowserExecutable();
  const launchOptions = {
    headless: true,
    args: ["--force-color-profile=srgb", "--hide-scrollbars"],
    ...(chromePath ? { executablePath: chromePath } : {}),
  };

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    const setup = await page.evaluate(async value => {
      if (!window.gcCommentStackExporter) throw new Error("This Studio build does not include the exporter API.");
      return window.gcCommentStackExporter.prepare(value);
    }, project);

    const totalMs = setup.durationMs + args.hold * 1000;
    const totalFrames = Math.max(1, Math.ceil(totalMs / 1000 * args.fps));
    console.log(`Rendering ${totalFrames} transparent 4K frames at ${args.fps} fps…`);

    for (let frame = 0; frame < totalFrames; frame += 1) {
      const timeMs = frame / args.fps * 1000;
      await page.evaluate(ms => window.gcCommentStackExporter.setFrame(ms), timeMs);
      const framePath = join(frameDir, `frame-${String(frame).padStart(6, "0")}.png`);
      await page.screenshot({ path: framePath, type: "png", omitBackground: true });
      if (frame === 0 || frame === totalFrames - 1 || (frame + 1) % 24 === 0) {
        process.stdout.write(`\rFrames: ${frame + 1}/${totalFrames}`);
      }
    }
    process.stdout.write("\n");
  } finally {
    if (browser) await browser.close();
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  const rate = ffmpegRate(args.fps);
  const encoder = chooseEncoder(args.encoder, frameDir);
  console.log(`Encoding ProRes 4444 with alpha using ${encoder.name}…`);
  run("ffmpeg", [
    "-y",
    "-framerate", rate,
    "-start_number", "0",
    "-i", join(frameDir, "frame-%06d.png"),
    ...encoder.args,
    "-r", rate,
    outputPath,
  ]);

  console.log(`Created: ${outputPath}`);
  if (args.frames) console.log(`PNG sequence kept at: ${frameDir}`);
  if (temporaryFrames) rmSync(frameDir, { recursive: true, force: true });
}

main().catch(error => {
  console.error(`\nExport failed: ${error.message}`);
  process.exitCode = 1;
});
