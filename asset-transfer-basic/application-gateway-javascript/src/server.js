
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

// Endpoint: GET all assets
app.get('/api/assets', async (req, res) => {
    try {
        const { contract, gateway, client } = await getContract();
        const result = await contract.evaluateTransaction('GetAllAssets');
        const json = JSON.parse(utf8Decoder.decode(result));
        res.json(json);
        gateway.close();
        client.close();
    } catch (err) {
        console.error('Failed to fetch assets:', err);
        res.status(500).send('Failed to fetch assets');
    }
});

// Create a new asset
app.use(express.json()); //This is required to parse JSON body
app.post('/api/assets', async (req, res) => {
    const { assetId, color, size, owner, appraisedValue } = req.body;

    if (!assetId || !color || !size || !owner || !appraisedValue) {
        return res.status(400).json({ error: 'Missing required asset fields.' });
    }

    try {
        const { contract, gateway, client } = await getContract();

        await contract.submitTransaction(
            'CreateAsset',
            assetId,
            color,
            size,
            owner,
            appraisedValue
        );

        res.json({ message: `Asset ${assetId} created successfully` });

        gateway.close();
        client.close();
    } catch (err) {
        console.error('Failed to create asset:', err);
        res.status(500).json({ error: 'Failed to create asset: ' + err.message });
    }
});

// Transfer asset
app.post('/api/assets/transfer', async (req, res) => {
    const { assetId, newOwner } = req.body;

    if (!assetId || !newOwner) {
        return res.status(400).json({ error: 'Missing assetId or newOwner in request body.' });
    }

    try {
        const { contract, gateway, client } = await getContract();

        const commit = await contract.submitAsync('TransferAsset', {
            arguments: [assetId, newOwner],
        });

        const oldOwner = new TextDecoder().decode(commit.getResult());

        const status = await commit.getStatus();
        if (!status.successful) {
            throw new Error(
                `Transaction ${status.transactionId} failed with status code ${status.code}`
            );
        }

        res.json({
            message: `Asset ${assetId} ownership transferred from ${oldOwner} to ${newOwner}`,
        });

        gateway.close();
        client.close();
    } catch (err) {
        console.error('Failed to transfer asset:', err);
        res.status(500).json({ error: 'Failed to transfer asset: ' + err.message });
    }
});

//Read asset
app.get('/api/assets/:id', async (req, res) => {
    const assetId = req.params.id;

    try {
        const { contract, gateway, client } = await getContract();

        const resultBytes = await contract.evaluateTransaction('ReadAsset', assetId);
        const resultJson = new TextDecoder().decode(resultBytes);
        const result = JSON.parse(resultJson);

        res.json(result);

        gateway.close();
        client.close();
    } catch (err) {
        console.error('Failed to read asset:', err);
        res.status(500).json({ error: 'Failed to read asset: ' + err.message });
    }
});

//Init Ledger
app.post('/api/init', async (req, res) => {
    try {
        const { contract, gateway, client } = await getContract();

        console.log('➡️ Calling InitLedger...');
        await contract.submitTransaction('InitLedger');

        res.json({ message: 'Ledger initialized successfully' });

        gateway.close();
        client.close();
    } catch (err) {
        console.error('Failed to initialize ledger:', err);
        res.status(500).json({ error: 'Failed to initialize ledger: ' + err.message });
    }
});

//create student
app.post('/api/students', async (req, res) => {
    const { nrp, name, ipk, program_studi } = req.body;

    try {
        const { contract, gateway, client } = await getContract();
        await contract.submitTransaction('CreateStudentAsset', nrp, name, ipk, program_studi);
        res.status(200).json({ message: 'Student asset created successfully' });

        gateway.close();
        client.close();
    } catch (error) {
        console.error(`Failed to create student asset: ${error}`);
        res.status(500).json({ error: 'Failed to create student asset' });
    }
});



// Start server
app.listen(PORT, () => {
    console.log(`REST API listening on http://localhost:${PORT}`);
});