# Chrome + Puppeteer préinstallés
FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Nettoyage de toute variable qui forcerait un mauvais binaire
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=""

# FFmpeg dans l'image (pas au runtime)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Dépendances Node
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

# Code applicatif
COPY server.js ./server.js
COPY public ./public

EXPOSE 8080
CMD ["node", "server.js"]
