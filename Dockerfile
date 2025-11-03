# Chrome + deps déjà prêts
FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# ffmpeg dans l'image (pas au runtime)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Dépendances Node
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

# Code applicatif
COPY server.js ./server.js
COPY public ./public

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
EXPOSE 8080
CMD ["node", "server.js"]
