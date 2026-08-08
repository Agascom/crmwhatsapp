# Déploiement

Ce guide couvre le déploiement complet : **OpenWA**, le **backend CRM** et l'**app mobile**, avec l'hébergement mutualisé Hostinger.

## Prérequis Hostinger

- Hébergement **mutualisé Business** (ou supérieur) — le support Node.js « Web Apps » est requis.
- Un nom de domaine + sous-domaines : `crm.votre-domaine.com` (backend) et `openwa.votre-domaine.com` (passerelle).
- Une **base MySQL** créée dans hPanel → **Bases de données**.
- Un compte **GitHub** (déploiement automatique).

---

## 0. Mettre le code sur GitHub (déploiement automatique)

Hostinger Web Apps se connecte à un dépôt GitHub et **rebuild automatiquement à chaque `git push`**. Un seul dépôt `crm-whatsapp` suffit : Hostinger gère les monorepos via le réglage **Root directory** (une Web App par sous-dossier).

Structure attendue :

```
crm-whatsapp/
├── backend/     → Web App n°1 (Root directory: backend)
├── openwa/      → Web App n°2 (Root directory: openwa)  ← code OpenWA modifié
└── mobile/      → versionné seulement, non déployé chez Hostinger
```

### 0.1 Créer le dépôt et pousser le code

```bash
cd C:\Users\makou\crm-whatsapp
git init
git add .
git commit -m "CRM WhatsApp : backend + mobile"
git branch -M main
git remote add origin https://github.com/VOTRE_USER/crm-whatsapp.git
git push -u origin main
```

Puis copiez le code OpenWA **modifié** (section 1) dans `openwa/` et committez.

### 0.2 Règles d'or

| Faire | Ne PAS faire |
|---|---|
| Committer `package.json` + `package-lock.json` | Committer `node_modules/` |
| Committer `.env.example` (valeurs factices) | Committer `.env` (mots de passe, clé API) |
| Saisir les secrets dans hPanel → **Environment variables** | Mettre la clé API OpenWA dans l'app mobile |

> Les variables d'environnement saisies dans hPanel persistent entre les déploiements.

### 0.3 Créer les deux Web Apps (hPanel)

1. **Websites → Add Website → Node.js web app → Import Git repository → Connect with GitHub** (installez l'app GitHub Hostinger, autorisez le dépôt).
2. Sélectionnez `crm-whatsapp` — la config se pré-remplit automatiquement.
3. Web App **backend** : Root directory `backend`, Node 22, Build command `npm run init-db`, Entry file `src/server.js`.
4. Web App **openwa** : Root directory `openwa`, Node 22, Build command `npm run build`, Entry file `dist/main.js`.
5. Renseignez les variables d'environnement de chaque app (sections 1 et 2).
6. **Déployer.** Chaque push sur `main` relance le build automatiquement.

---

## 1. Déployer OpenWA (la passerelle WhatsApp)

OpenWA tourne comme **application Node.js** sur le même hébergement (une 2e « Web App »). Pas de Docker possible en mutualisé.

### 1.1 Le code est déjà dans le dépôt

Le code OpenWA (v0.14.6) est versionné dans **`openwa/`**, sans les fichiers Docker (`Dockerfile`, `docker-compose*.yml`, `.dockerignore`, `docker-entrypoint.sh`, `charts/`) — inutilisables en mutualisé. Le `.env.example` est fourni par OpenWA lui-même.

> `ENGINE_TYPE=baileys` est **obligatoire** : ce moteur ne demande pas de Chromium (~30-80 Mo RAM/session) contrairement à `whatsapp-web.js`. Sans lui, OpenWA démarre sur le moteur par défaut `whatsapp-web.js` (lourd et fragilent en mutualisé).

### 1.2 Port déjà géré

OpenWA 0.14.6 lit déjà `process.env.PORT` (défaut `2785`) — **aucun patch n'est nécessaire**. Hostinger injecte automatiquement `PORT` et le code écoute sur le bon port. Vérifiez localement que le build passe :

```bash
npm ci
npm run build
```

### 1.3 Envoyer sur Hostinger (hPanel)

1. Copiez le dossier OpenWA modifié dans le dépôt `crm-whatsapp/openwa` et poussez (`git add . && git commit && git push`).
2. Dans hPanel : **Add Website → Node.js web app → Import Git repository**.
3. Sélectionnez le dépôt → **Root directory : `openwa`**.
4. Node.js version : **22**.
5. **Build command : laisser vide** — le dossier `dist/` pré-compilé est déjà committé (le build TypeScript `nest build` échoue en mémoire limitée sur le mutualisé). En cas de modification du code, régénérez `dist/` en local puis committez :
   ```bash
   cd openwa && npm ci && npm run build && cd ..
   git add openwa/dist && git commit -m "openwa: regen dist" && git push
   ```
6. Entry file : `dist/main.js`.
7. Dans **Variables d'environnement** : `ENGINE_TYPE=baileys`, `DATABASE_TYPE=sqlite`, `NODE_ENV=production` (Hostinger injecte aussi `PORT`).
8. **Deploy**, puis ouvrez `https://openwa.votre-domaine.com` → dashboard OpenWA.
9. Créez une session WhatsApp, scannez le QR, attendez le statut **ready**.
10. Récupérez la clé API : menu **API Keys** (ou fichier `data/.api-key` via le File Manager).

### 1.4 Garder la connexion vivante (cron)

Le mutualisé peut « endormir » le process inactif → WhatsApp se déconnecte. Dans hPanel → **Cron Jobs** :

```
curl -s https://openwa.votre-domaine.com/api/health > /dev/null 2>&1
```

Toutes les 5 minutes. Ce ping maintient le process actif.

> ⚠️ La clé API OpenWA est à placer **uniquement** dans le `.env` du backend CRM. Ne la mettez jamais dans l'app mobile.

---

## 2. Déployer le backend CRM

### 2.1 Configurer `.env`

```
PORT=3000
ADMIN_USER=admin
ADMIN_PASSWORD=mot-de-passe-fort
JWT_SECRET=<longue-chaine-aleatoire>
PUBLIC_URL=https://crm.votre-domaine.com
DB_HOST=localhost
DB_USER=<user-mysql-hostinger>
DB_PASSWORD=<mdp-mysql>
DB_NAME=<nom-base-hostinger>
OPENWA_URL=https://openwa.votre-domaine.com
OPENWA_API_KEY=<cle-openwa>
WEBHOOK_SECRET=<chaine-aleatoire>
```

> `PUBLIC_URL` est l'URL du **backend** (c'est lui qui reçoit les webhooks OpenWA).

### 2.2 Envoyer sur Hostinger (hPanel)

1. **Websites → Add Website → Node.js web app → Import Git repository** (dépôt déjà connecté, voir section 0).
2. Sélectionnez le dépôt `crm-whatsapp` → **Root directory : `backend`**.
3. Node.js **22**.
4. Build command : `npm run init-db` (crée les tables MySQL, idempotent).
5. Entry file : `src/server.js`.
6. **Variables d'environnement** : saisissez tout le bloc `.env` de la section 2.1 (hPanel les injecte au build et au runtime, pas besoin de commit).
7. **Deploy.** Chaque `git push` sur `main` redéploie automatiquement le backend.

### 2.3 Vérifier

- `https://crm.votre-domaine.com/health` → `{"status":"ok"}`
- Au démarrage, les logs affichent `Webhooks OpenWA: [{"session":"...","status":"enregistre"}]`.
- Le backend enregistre automatiquement son webhook sur chaque session OpenWA.

---

## 3. App mobile

1. `cd mobile` puis `npm install`.
2. Dans `app.json`, renseignez `extra.apiUrl` avec `https://crm.votre-domaine.com`.
3. `npx expo start`, testez avec **Expo Go** sur votre téléphone.
4. Pour un APK autonome : `npx expo run:android` ou un build EAS (`npx eas build --profile preview`).

L'écran de connexion permet aussi de modifier l'adresse du serveur depuis le téléphone.

---

## Ordre de mise en route

1. Déployer OpenWA + connecter le numéro (QR) + récupérer la clé API.
2. Déployer le backend CRM (avec clé API + webhook).
3. Vérifier `health` + les logs webhooks.
4. Installer et tester l'app mobile.

## Dépannage rapide

| Problème | Solution |
|---|---|
| `Aucune session WhatsApp prête` | Le numéro n'est pas connecté dans le dashboard OpenWA |
| Webhooks non enregistrés | Vérifier `PUBLIC_URL` (doit être HTTPS et public) et que la clé API a le rôle OPERATOR |
| L'app ne reçoit pas les messages | Vérifier le cron de maintien OpenWA + les logs du backend |
| Erreur MySQL au démarrage | Vérifier les identifiants MySQL hPanel et que la base existe |
