# 🎥 Auto Scroll Capture – Playwright + FFmpeg + Express (Docker)

Ce projet permet de **capturer automatiquement une page web en défilement**, puis de générer automatiquement une vidéo **WebM**, **MP4** et un **GIF**.

Le tout repose sur :
- [Playwright](https://playwright.dev) pour la capture vidéo et le défilement,
- [FFmpeg](https://ffmpeg.org/) pour la conversion,
- [Express](https://expressjs.com) pour le backend HTTP,
- Une **interface HTML/CSS** moderne pour lancer la capture.

---

## 🚀 Lancer le projet en Docker (via Portainer ou Docker CLI)

### ⚙️ Pré-requis

- Docker ou Portainer
- Git (si tu veux cloner depuis GitHub)

### 📁 Arborescence du projet

```
.
├─ server.mjs
├─ package.json
├─ public/
│  └─ index.html
├─ videos/              # généré automatiquement
└─ Dockerfile
```

---

## 🧰 Démarrage rapide avec Docker

### 1️⃣ Construire l’image

```bash
docker build -t scroll-recorder .
```

### 2️⃣ Lancer le conteneur

```bash
docker run -d -p 9763:3000 -v "$(pwd)/videos:/app/videos" --name scroll-recorder scroll-recorder
```

➡️ Accède à l’interface : [http://localhost:9763](http://localhost:9763)

---

## 🧩 Déploiement via Portainer Stack

Copie/colle ce **docker-compose.yml** dans une stack Portainer :

```yaml
version: "3.9"
services:
  scroll-recorder:
    build: .
    container_name: scroll-recorder
    restart: unless-stopped
    ports:
      - "9763:3000"
    volumes:
      - ./videos:/app/videos
```

> 💡 Portainer construira automatiquement l’image depuis ton dépôt GitHub et exposera le service sur `https://<ton-serveur>:9763`

---

## 🖥️ Interface web

Interface simple et responsive :

- URL à capturer
- Largeur / hauteur personnalisables
- Durée du scroll (en ms)
- Option “scroll lissé”
- Affichage live des logs
- Résultats (vidéos / GIF téléchargeables)

---

## 🔒 Variables d’environnement (optionnelles)

| Variable | Description | Valeur par défaut |
|-----------|-------------|-------------------|
| `PORT` | Port interne d’écoute du serveur | `3000` |
| `VIDEO_DIR` | Dossier où sont stockées les vidéos | `/app/videos` |

---

## 🧪 Test local sans Docker

```bash
npm install
node server.mjs
```

Puis ouvre : [http://localhost:3000](http://localhost:3000)

---

## 🧱 Stack technique

- Node.js (ESM)
- Playwright Chromium
- FFmpeg via fluent-ffmpeg
- Express 4
- HTML/CSS vanilla (sans framework)
- Docker / Portainer ready

---

## 🏷️ Auteur

**Dieu**  
Administrateur Système & Réseau / Dev SecOPS

---

Fait avec ❤️ et un peu de magie Playwright ✨
