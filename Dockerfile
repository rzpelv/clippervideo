# Multi-stage build: only the built dist/ + server.js end up in the final
# image. ClipperVideo is a fully client-side app (ffmpeg.wasm + direct AI
# calls from the browser), so the runtime image is just Node + tini.

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
# `npm run build` runs the `prebuild` hook first, which downloads
# ffmpeg-core into public/ffmpeg/ so Vite ships it as a same-origin asset.
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173

# tini is PID 1 so SIGTERM from Railway propagates cleanly to the Node
# process. ca-certificates is here so the Node fetch runtime can reach
# any optional outbound endpoint, though server.js itself makes no
# network calls.
RUN apk add --no-cache ca-certificates tini

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/package.json ./package.json

EXPOSE 4173

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
