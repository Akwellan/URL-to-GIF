# --- Étape 1 : image de base Playwright avec Node
FROM mcr.microsoft.com/playwright:v1.56.1-jammy

# --- Étape 2 : définir le dossier de travail
WORKDIR /app

# --- Étape 3 : copier les fichiers
COPY package*.json ./
COPY server.mjs ./
COPY public ./public

# --- Étape 4 : installer les dépendances
RUN npm install --production

# --- Étape 5 : créer dossier vidéos
RUN mkdir -p /app/videos

# --- Étape 6 : exposer le port interne
EXPOSE 3000

# --- Étape 7 : définir la commande de démarrage
CMD ["node", "server.mjs"]
