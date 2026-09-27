# LogicOmni public website

This repository contains the static LogicOmni website. The served site is in
`public/`: HTML pages, local CSS and JavaScript, a favicon, `robots.txt`, and
`sitemap.xml`. `vercel.json` contains hosting settings; `SHA256SUMS` records
file checksums.

## Local preview

From the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory public
```

Open `http://127.0.0.1:8000/` in a browser. Stop the server when finished.
For an integrity check, run `sha256sum -c SHA256SUMS` from the repository root.

## Vercel settings

| Setting | Value |
|---|---|
| Root Directory | repository root (`.`) |
| Framework Preset | Other |
| Output Directory | `public` |
| Build Command | none |
| Install Command | none |
| Environment Variables | none |

The site is static. Its code sets no cookies and has no form, analytics,
backend, or third-party script. The contact link opens the visitor's email
client; the website itself sends nothing automatically. Hosting response
headers are configured in `vercel.json`; verify them on any live deployment.
