# 🌐 URL → GIF (Web2GIF)

> Génère automatiquement un **GIF animé défilant** à partir d’une **URL**.  
> 100 % self-hosted, basé sur **Puppeteer + FFmpeg**, sans dépendance SaaS.

---

## 🚀 Déploiement via Portainer

1. Ouvre ton Portainer → **Stacks → Add stack**  
2. Sélectionne **Repository**
3. Mets l’URL de ce dépôt GitHub dans le champ :

   ```
   https://github.com/Akwellan/URL-to-GIF.git
   ```
4. Laisse `refs/heads/main` (ou `master` selon ton repo)
5. Dans **Compose path**, garde :
   ```
   docker-compose.yml
   ```
6. Clique **Deploy the stack**

➡️ Une fois lancé, accède à :
```
http://<IP_SERVEUR>:8080
```

---

## 🧠 Utilisation

- Saisis une **URL complète** (ex. https://example.com)  
- Ajuste les **paramètres** (largeur, durée, FPS, vitesse de scroll, etc.)  
- Clique sur **Générer le GIF**  
- Télécharge ou prévisualise le résultat 🎞️

---

## ⚙️ Paramètres disponibles

| Nom du champ | Description | Valeur par défaut |
|---------------|--------------|-------------------|
| `width` | Largeur de capture en pixels | 1280 |
| `height` | Hauteur de capture en pixels | 800 |
| `fps` | Nombre d’images par seconde | 10 |
| `startDelay` | Délai avant le début de capture (ms) | 1500 |
| `duration` | Durée totale du scroll (ms) | 6000 |
| `scrollStep` | Pas de défilement entre deux captures (px/frame) | 40 |
| `slowAnimations` | Ralentit les animations CSS pour plus de lisibilité | false |

---

## 🐋 Détails techniques

- **Node.js + Express** : serveur minimaliste pour l’API et l’UI.  
- **Puppeteer** : Chrome headless pour naviguer, scroller et capturer.  
- **FFmpeg** : assemble les captures en un GIF optimisé (palettegen/paletteuse).  
- **Docker Compose** : conteneur tout-en-un, auto-suffisant.

---

## 🧩 Exemple rapide (en local)

```bash
git clone https://github.com/Akwellan/URL-to-GIF.git
cd urltogif
docker compose up --build
# Ouvre http://localhost:8080
```

---

## 🛡️ Notes

- `shm_size: 2gb` est requis pour Chrome headless.  
- Si exposé publiquement : protège le port 8080 derrière un proxy (Nginx ou Traefik).  
- Les GIFs sont temporaires et non stockés.

---

## 💡 Auteur

Projet Dockerisé par **Dieu** 🧠  
Contact : _Administrateur Système & DevSecOps_
