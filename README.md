# Gaming Careers Graphics Tools

Three offline, browser-based production tools for Gaming Careers videos:

- **Tier List** — drag-and-drop software rankings with an automatic winner moment.
- **Social Comments** — platform-faithful animated comments with transparent ProRes 4444 export.
- **Benchmark Charts** — configurable, animated 4K benchmark graphics.

## Open the toolkit

Double-click `index.html` in the repository root. The launcher opens each tool in a new browser tab. The tools are self-contained and do not require a server or internet connection.

Settings save in the browser automatically. Use each tool's project export controls for configurations you want to keep or move to another computer.

## Transparent comment exports

The Social Comments exporter requires Node.js, ffmpeg and a Chromium-based browser. The full guide is at [`tools/social-comments/EXPORTING.md`](tools/social-comments/EXPORTING.md).

From the Social Comments folder:

```bash
node comment-stack-exporter.mjs \
  --project comment-stack-project.json \
  --output comment-stack-alpha.mov
```

The exporter automatically uses Apple VideoToolbox ProRes hardware when genuine 4K alpha support is available and falls back to software ProRes when it is not.

## Editing and rebuilding

Editable templates live in `src/`. Finished, ready-to-open tools live in `tools/`.

After changing a template or shared asset, rebuild all three tools with:

```bash
npm run build
```

No npm packages are required for the build.

## Presets

Keep reusable exported project JSON in the matching folder under `presets/`. Put private or one-off data in `presets/private/`; that folder is ignored by Git.

## Generated media

Rendered videos and frame sequences do not belong in the repository. The `.gitignore` excludes the common render folders and video extensions. Keep final renders with the relevant video project or archive.

## Connecting the private GitHub repository

After creating an empty private repository on GitHub:

```bash
git remote add origin git@github.com:YOUR-ACCOUNT/gaming-careers-graphics-tools.git
git push -u origin main
```
