# Comment Stack Studio — transparent export

The exporter renders the Studio animation frame-by-frame at 3840×2160, then encodes a ProRes 4444 `.mov` with a real alpha channel. It uses the 23.976 fps timeline by default.

## Export a configured animation

1. Open `comment-stack-studio.html`, finish the design, and click **Export setup**.
2. Open Terminal in this folder.
3. Run:

```bash
node comment-stack-exporter.mjs \
  --project /path/to/comment-stack-project.json \
  --output /path/to/comment-stack-alpha.mov
```

The completed frame holds for 1.5 seconds. Change that with `--hold`, for example `--hold 3`.

The default `--encoder auto` mode tests Apple VideoToolbox with a real alpha frame. If the Mac supports hardware ProRes 4444 with alpha, it uses it. Otherwise it automatically falls back to the compatible software ProRes encoder. You can force either path with `--encoder videotoolbox` or `--encoder software`.

The exporter performs the capability test at the actual 4K frame size instead of guessing from the Mac model. H.264/HEVC engines cannot produce the transparent overlay required here. NVIDIA NVENC likewise does not encode ProRes 4444 or a Resolve-friendly alpha video; on a Windows/NVIDIA machine this exporter therefore uses software ProRes rather than silently discarding transparency.

## Keep the transparent PNG frames too

```bash
node comment-stack-exporter.mjs \
  --project /path/to/comment-stack-project.json \
  --output /path/to/comment-stack-alpha.mov \
  --frames /path/to/comment-stack-frames
```

## DaVinci Resolve

Import the `.mov` normally and place it on a track above the edit. Resolve should read the ProRes 4444 alpha automatically. If it appears black, right-click the clip, choose **Clip Attributes → Alpha Mode**, and select **Straight**.

Run `node comment-stack-exporter.mjs --help` for every option.
