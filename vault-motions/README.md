# Motion Vault — generated motion videos

Every motion video generated for this site goes here, and it appears automatically
in the private Motion Vault (☰ → Masuk). Nobody has to upload it by hand.

To add a new one:

1. Put the rendered video file (MP4, H.264 + AAC) in this folder.
2. Optionally add a JPEG poster frame for the vault thumbnail.
3. Add an entry to `manifest.json`:

```json
{ "id": "kebab-case-id", "file": "my-motion.mp4", "thumb": "my-motion.jpg",
  "name": "File name shown and used for download.mp4", "type": "video/mp4",
  "created": "2026-11-04T00:00:00Z", "desc": "Short description" }
```

The files are bundled with the `vault` function (see `netlify.toml`) and are only
served to a logged-in session. Direct URLs to this folder return 404.
