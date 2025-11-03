FROM ghcr.io/puppeteer/puppeteer:latest
USER root
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

COPY server.js ./server.js
COPY public ./public

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
EXPOSE 8080
CMD ["node", "server.js"]
