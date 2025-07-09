## 📦 Hyperledger Fabric – `README.md`

````markdown
# Blockchain Voting System – Hyperledger Fabric (Chaincode + REST API)

This project is part of a hybrid blockchain-based voting system. It uses Hyperledger Fabric to securely and transparently store voting data per TPS (Tempat Pemungutan Suara).

## 📁 Structure

- `chaincode/` – Chaincode written in JavaScript for TPS asset management.
- `server.js` – Express.js REST API to interact with the blockchain network.

## 🧩 Features

- Register new TPS with voter capacity.
- Register voters to a TPS.
- Cast a vote (updates user's HasVoted, total votes, and results).
- Update vote results for Paslon A and B.
- Read and query TPS assets from the ledger.

## 🛠️ Setup

### Prerequisites

- Node.js (v16 or later)
- Docker & Docker Compose
- Hyperledger Fabric test network
- Fabric Gateway SDK (`@hyperledger/fabric-gateway`)
- `jq` (for UNIX-based systems)

### 1. Start the Fabric Network

```bash
cd fabric-samples/test-network
./network.sh up createChannel -ca
./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-javascript -ccl javascript
````

### 2. Start REST API Server

```bash
cd asset-transfer-basic/application-express
npm install
node server.js
```

Server runs on: [http://localhost:3000](http://localhost:3000)

## 📡 API Endpoints

| Method | Endpoint            | Description                       |
| ------ | ------------------- | --------------------------------- |
| GET    | `/api/assets`       | List all TPS assets               |
| GET    | `/api/assets/:id`   | Read a specific TPS asset         |
| POST   | `/api/assets`       | Create new TPS                    |
| POST   | `/api/register`     | Register user to a TPS            |
| POST   | `/api/vote`         | Cast vote from a user             |
| POST   | `/api/vote-results` | Submit final vote results to TPS  |
| POST   | `/api/init`         | (Optional) Initialize default TPS |

## ✍️ Chaincode Methods

* `CreateAsset`
* `ReadAsset`
* `RegisterUsers`
* `CastVote`
* `UpdateVoteResults`
* `GetAllAssets`

## 🔒 Notes

* Each TPS asset stores:

  * `TotalVoters`, `TotalVoted`
  * Voters list with HasVoted flag
  * Vote results per Paslon
* `InitLedger` is optional; data should be synced by Laravel seeder/API.
