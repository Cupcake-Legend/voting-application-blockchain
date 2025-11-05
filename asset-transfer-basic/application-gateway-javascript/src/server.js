
const express = require('express');
const cors = require('cors');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('fs/promises');
const path = require('path');
const { TextDecoder } = require('util');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const utf8Decoder = new TextDecoder();

// Fabric config
const mspId = 'Org1MSP';
const channelName = 'mychannel';
const chaincodeName = 'basic';
const cryptoPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'test-network',
    'organizations',
    'peerOrganizations',
    'org1.example.com'
);
const keyPath = path.resolve(
    cryptoPath,
    'users',
    'User1@org1.example.com',
    'msp',
    'keystore'
);
const certPath = path.resolve(
    cryptoPath,
    'users',
    'User1@org1.example.com',
    'msp',
    'signcerts'
);
const tlsCertPath = path.resolve(
    cryptoPath,
    'peers',
    'peer0.org1.example.com',
    'tls',
    'ca.crt'
);
const peerEndpoint = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';

async function newGrpcConnection() {
    const grpc = require('@grpc/grpc-js');
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity() {
    const certFiles = await fs.readdir(certPath);
    const credentials = await fs.readFile(path.join(certPath, certFiles[0]));
    return { mspId, credentials };
}

async function newSigner() {
    const keyFiles = await fs.readdir(keyPath);
    const privateKeyPem = await fs.readFile(path.join(keyPath, keyFiles[0]));
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

async function getContract() {
    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        hash: require('@hyperledger/fabric-gateway').hash.sha256,
    });

    const network = gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);
    return { contract, gateway, client };
}

//Init ledger
app.post('/api/init', async (req, res) => {
    try {
        const { contract, gateway, client } = await getContract();
        await contract.submitTransaction('InitLedger');
        res.json({ message: 'Ledger initialized' });
        gateway.close();
        client.close();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//Get all assets
app.get('/api/tps', async (req, res) => {
    try {
        const { contract, gateway, client } = await getContract();
        const result = await contract.evaluateTransaction('GetAllAssets');
        res.json(JSON.parse(utf8Decoder.decode(result)));
        gateway.close();
        client.close();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


//New TPS
app.post('/api/tps', async (req, res) => {
    const { id, name, totalVoters } = req.body;

    if (!id || !name || totalVoters === undefined) {
        return res.status(400).json({ error: 'Missing TPS fields' });
    }

    try {
        console.log('➡️ Creating TPS in chaincode:', { id, name, totalVoters });
        const { contract, gateway, client } = await getContract();
        const result = await contract.submitTransaction('CreateAsset', id, name, String(totalVoters));
        console.log('Chaincode result:', result.toString());
        res.json({ message: `TPS ${id} created`, result: result.toString() });
        gateway.close();
        client.close();
    } catch (err) {
        console.error('Chaincode error:', err);
        res.status(500).json({ error: err.message });
    }
});


//Register Users
app.post('/api/register', async (req, res) => {
    const { tpsId, userId, username } = req.body;
    console.log('Received body:', req.body);
    if (!tpsId || !userId || !username) {
        return res.status(400).json({ error: 'Missing register user fields' });
    }

    try {
        const { contract, gateway, client } = await getContract();
        await contract.submitTransaction('RegisterUsers', tpsId, userId, username);
        res.json({ message: `User ${userId} registered to TPS ${tpsId}` });
        gateway.close();
        client.close();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cast a vote
app.post('/api/vote', async (req, res) => {
    const { tpsId, userId } = req.body;

    if (!tpsId || !userId) {
        return res.status(400).json({ error: 'Missing tpsId or userId' });
    }

    try {
        const { contract, gateway, client } = await getContract();

        const resultBytes = await contract.submitTransaction('CastVote', tpsId, userId);
        const resultJson = new TextDecoder().decode(resultBytes);
        const result = JSON.parse(resultJson);

        res.json(result);

        gateway.close();
        client.close();
    } catch (err) {
        console.error('Failed to cast vote:', err);
        res.status(500).json({ error: 'Failed to cast vote: ' + err.message });
    }
});

app.post('/api/vote-results', async (req, res) => {
    const { tpsId, paslonA, paslonB } = req.body;
    if (!tpsId || paslonA == null || paslonB == null) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    try {
        const { contract, gateway, client } = await getContract();

        await contract.submitTransaction('UpdateVoteResults', tpsId, paslonA.toString(), paslonB.toString());

        res.json({ message: 'Vote results updated' });

        gateway.close();
        client.close();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});






// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`REST API listening on http://localhost:${PORT}`);
});