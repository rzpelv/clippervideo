# Multi-stage build: only the built dist/, server.js, and the runtime
# binaries (Node + Python + ffmpeg + yt-dlp) end up in the final image.

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173 \
    YTDLP_BIN=/usr/local/bin/yt-dlp

# Python + ffmpeg are required by yt-dlp.
RUN apk add --no-cache python3 ffmpeg ca-certificates tini

# Download the latest yt-dlp standalone binary. Using ADD with a remote URL
# means Docker checksum-checks the upstream file each build, so when yt-dlp
# ships a new release the cached layer is invalidated and we pick it up.
# (RUN wget would always be cache-hit until the instruction text changes,
# which is why builds were silently shipping a stale yt-dlp.)
ADD https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp /usr/local/bin/yt-dlp
RUN chmod +x /usr/local/bin/yt-dlp && \
    /usr/local/bin/yt-dlp --version

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/package.json ./package.json

EXPOSE 4173

# tini gives us proper signal handling so SIGTERM cleanly stops yt-dlp children.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
