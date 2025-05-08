/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// Deterministic JSON.stringify()
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

class AssetTransfer extends Contract {
    async InitLedger(ctx) {
        const assets = [
            // Vote results and users are empty at the beginning to ensure that every transaction is stored in the blockchain . - darren
            {
                ID: 'TPS1',
                Name: 'Rungkut',
                TotalVoters: 100,
                TotalVoted: 0,
                ResultsImage: '',
                VoteResults: {
                    PaslonA: 0,
                    PaslonB: 0,
                },
                Users: [],
                docType: 'TPS',
            },
            {
                ID: 'TPS2',
                Name: 'Gubeng',
                TotalVoters: 100,
                TotalVoted: 0,
                ResultsImage: '',
                VoteResults: {
                    PaslonA: 0,
                    PaslonB: 0,
                },
                Users: [],
                docType: 'TPS',
            },
            {
                ID: 'TPS3',
                Name: 'Gunung Anyar',
                TotalVoters: 100,
                TotalVoted: 0,
                ResultsImage: '',
                VoteResults: {
                    PaslonA: 0,
                    PaslonB: 0,
                },
                Users: [],
                docType: 'TPS',
            },
            {
                ID: 'TPS4',
                Name: 'Kenjeran',
                TotalVoters: 100,
                TotalVoted: 0,
                ResultsImage: '',
                VoteResults: {
                    PaslonA: 0,
                    PaslonB: 0,
                },
                Users: [],
                docType: 'TPS',
            },
        ];

        for (const asset of assets) {
            asset.docType = 'asset';
            // example of how to write to world state deterministically
            // use convetion of alphabetic order
            // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
            // when retrieving data, in any lang, the order of data will be the same and consequently also the corresonding hash
            await ctx.stub.putState(
                asset.ID,
                Buffer.from(stringify(sortKeysRecursive(asset)))
            );
        }
    }

    // CreateAsset issues a new asset to the world state with given details.
    async CreateAsset(ctx, id, name, totalVoters) {
        const exists = await this.AssetExists(ctx, id);
        if (exists) {
            throw new Error(`The asset ${id} already exists`);
        }

        const asset = {
            ID: id,
            Name: name,
            TotalVoters: Number(totalVoters),
            TotalVoted: 0,
            ResultsImage: '',
            VoteResults: {
                PaslonA: 0,
                PaslonB: 0,
            },
            Users: [],
            docType: 'TPS', //add docType : TPS to ensure document filtering is easier in the future -darren
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(
            id,
            Buffer.from(stringify(sortKeysRecursive(asset)))
        );
        return JSON.stringify(asset);
    }

    // ReadAsset returns the asset stored in the world state with given id.
    async ReadAsset(ctx, id) {
        const assetJSON = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return assetJSON.toString();
    }

    // UpdateAsset updates an existing asset in the world state with provided parameters.
    async UpdateAsset(ctx, id, color, size, owner, appraisedValue) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }

        // overwriting original asset with new asset
        const updatedAsset = {
            ID: id,
            Color: color,
            Size: size,
            Owner: owner,
            AppraisedValue: appraisedValue,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        return ctx.stub.putState(
            id,
            Buffer.from(stringify(sortKeysRecursive(updatedAsset)))
        );
    }

    // DeleteAsset deletes an given asset from the world state.
    async DeleteAsset(ctx, id) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }

    // AssetExists returns true when asset with given ID exists in world state.
    async AssetExists(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        return assetJSON && assetJSON.length > 0;
    }

    // TransferAsset updates the owner field of asset with given id in the world state.
    async TransferAsset(ctx, id, newOwner) {
        const assetString = await this.ReadAsset(ctx, id);
        const asset = JSON.parse(assetString);
        const oldOwner = asset.Owner;
        asset.Owner = newOwner;
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(
            id,
            Buffer.from(stringify(sortKeysRecursive(asset)))
        );
        return oldOwner;
    }

    // GetAllAssets returns all assets found in the world state.
    async GetAllAssets(ctx) {
        const allResults = [];
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(
                result.value.value.toString()
            ).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

    //NEW METHODS

    async RegisterUsers(ctx, tpsId, userId, username) {
        const tpsAsBytes = await ctx.stub.getState(tpsId);
        if (!tpsAsBytes || tpsAsBytes.length === 0) {
            throw new Error(`TPS with ID ${tpsId} does not exist`);
        }

        const tps = JSON.parse(tpsAsBytes.toString());

        const userExists = tps.Users.some((user) => user.ID === userId);
        if (userExists) {
            throw new Error(
                `User with ID ${userId} is already registered at this TPS`
            );
        }

        // Create new user
        const newUser = {
            ID: userId,
            Name: username,
            HasVoted: false,
        };

        // Push to the Users array in TPS
        tps.Users.push(newUser);

        // Update TPS code
        await ctx.stub.putState(tpsId, Buffer.from(JSON.stringify(tps)));

        return JSON.stringify(newUser);
    }
}

module.exports = AssetTransfer;