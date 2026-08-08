# CRM WhatsApp

Application mobile CRM basée sur WhatsApp, construite autour de la passerelle **OpenWA** (API WhatsApp auto-hébergée, open source).

## Architecture

```
[📱 App mobile Expo]──►[🖥️ Backend CRM (Express)]──►[OpenWA API]──►WhatsApp
        clients             logique métier + MySQL        passerelle
                            ◄── webhooks (messages entrants)──┘
```

- **`mobile/`** — Application React Native (Expo) : login, conversations, chat, contacts, fiches clients.
- **`backend/`** — API Node.js (Express) qui connecte l'app mobile à OpenWA, stocke les données CRM (MySQL) et reçoit les webhooks de messages entrants.
- **OpenWA** — Passerelle WhatsApp à déployer séparément (voir `DEPLOYMENT.md`).

## Démarrage rapide (en local)

### 1. Backend

Prérequis : Node.js 18+ et **MySQL** (local : XAMPP / MAMP / WAMP).

```bash
cd backend
npm install
cp .env.example .env        # puis renseignez le fichier
npm run init-db             # crée les tables
npm run dev                 # http://localhost:3000
```

### 2. App mobile

```bash
cd mobile
npm install
npx expo start              # scannable via l'app Expo Go sur le téléphone
```

Dans l'écran de connexion, saisissez l'adresse du serveur : `http://<IP-PC>:3000` (même réseau Wi-Fi).

### 3. OpenWA

Voir `DEPLOYMENT.md` pour l'installation (VPS Docker ou hébergement Hostinger avec Node.js).

## Fonctionnalités

| Écran | Description |
|---|---|
| Login | Authentification (identifiant + mot de passe du backend) |
| Conversations | Liste des conversations, dernier message, badge non-lu, refresh auto |
| Chat | Envoyer des messages, historique, statut lu |
| Contacts | CRUD clients, recherche, statut (prospect / client / finalisé), notes |
| Fiche client | Modifier le client, ouvrir sa conversation WhatsApp |
| Réglages | Adresse du serveur, état de connexion WhatsApp, déconnexion |

## Flux des messages entrants

1. Un client écrit sur WhatsApp.
2. OpenWA envoie un webhook `message.received` au backend (signé HMAC).
3. Le backend vérifie la signature, stocke le message, crée automatiquement le contact inconnu.
4. L'app mobile rafraîchit (polling 5s) et affiche le badge non-lu.

## Sécurité

- L'app mobile ne touche jamais OpenWA directement : elle passe par le backend (clé API OpenWA cachée côté serveur).
- Les webhooks OpenWA sont signés en HMAC-SHA256 (`X-OpenWA-Signature`) et vérifiés.
- Authentification mobile par JWT (7 jours).
- Délivrance des webhooks "au moins une fois" : le backend déduplique via `idempotency_key`.

## Limites connues

- **Numéro WhatsApp** : OpenWA n'est pas l'API officielle de Meta. Risque de restriction du numéro — utiliser un numéro dédié.
- **Hébergement mutualisé** : la connexion WhatsApp nécessite un processus Node permanent ; prévoir un cron de maintien (voir `DEPLOYMENT.md`).
