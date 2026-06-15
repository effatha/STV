# Stremio Live TV Addon

Stream live TV channels in Stremio using your M3U playlist URL or Xtream Codes credentials.

## Quick Start

```bash
npm install
npm start
```

Then open **http://localhost:7860/configure** in your browser.

## Usage

### M3U Playlist
Paste your `.m3u` or `.m3u8` playlist URL. The addon will:
- Parse all channels automatically
- Group them by `group-title` attribute
- Show channel logos from `tvg-logo`

### Xtream Codes
Enter your provider's **Server URL**, **Username**, and **Password**. The addon uses the Xtream Codes API to fetch categories and live streams.

## How It Works

1. Fill in the configuration form at `/configure`
2. Click **Generate Install Link** — you get a `stremio://` deep link
3. Click the link (or paste it into Stremio) to install

The addon encodes your config as base64 in the URL path, so no server-side storage is needed.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `7860`  | HTTP port   |

## Deploying

The addon is a plain Express server — deploy it anywhere:

- **Locally**: `npm start` then use `http://your-local-ip:7860`
- **Railway / Render / Fly.io**: push to git, set `PORT` if needed
- **Docker**: `docker run -p 7860:7860 your-image`

For remote deployments, update the `configurationURL` in `index.js` to your public URL.
