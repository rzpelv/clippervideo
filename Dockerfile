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
RUN apk add --no-cache python3 ffmpeg ca-certificates wget tini && \
    wget -qO /usr/local/bin/yt-dlp \
        https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    /usr/local/bin/yt-dlp --version

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/package.json ./package.json

EXPOSE 4173

# tini gives us proper signal handling so SIGTERM cleanly stops yt-dlp children.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
