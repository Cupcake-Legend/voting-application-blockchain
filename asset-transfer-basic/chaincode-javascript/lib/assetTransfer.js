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
        const tpsList = [
            { ID: 'TPS1', Name: 'Rungkut' },
            { ID: 'TPS2', Name: 'Gubeng' },
            { ID: 'TPS3', Name: 'Gunung Anyar' },
            { ID: 'TPS4', Name: 'Kenjeran' },
        ];

        for (const tps of tpsList) {
            const newTPS = {
                ID: tps.ID,
                Name: tps.Name,
                TotalVoters: 0, // can be incremented later via RegisterUsers
                TotalVoted: 0,  // increment when votes are submitted
                ResultsImage: '',
                VoteResults: {
                    PaslonA: 0,
                    PaslonB: 0,
                },
                Users: [], // array of { ID, Name, HasVoted }
                docType: 'TPS',
            };

            await ctx.stub.putState(
                newTPS.ID,
                Buffer.from(stringify(sortKeysRecursive(newTPS)))
            );
        }
    }

    // CreateAsset issues a new asset to the world state with given details.
    async CreateAsset(ctx, id, name, totalVoters = 0) {
        const exists = await this.AssetExists(ctx, id);
        if (exists) {
            throw new Error(`The TPS ${id} already exists`);
        }

        const newTPS = {
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
            docType: 'TPS',
        };

        await ctx.stub.putState(
            id,
            Buffer.from(stringify(sortKeysRecursive(newTPS)))
        );

        return JSON.stringify(newTPS);
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
    async UpdateAsset(ctx, id, name, totalVoters, resultsImage) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The TPS ${id} does not exist`);
        }

        const assetString = await this.ReadAsset(ctx, id);
        const asset = JSON.parse(assetString);

        asset.Name = name || asset.Name;
        asset.TotalVoters = totalVoters !== undefined ? Number(totalVoters) : asset.TotalVoters;
        asset.ResultsImage = resultsImage || asset.ResultsImage;

        await ctx.stub.putState(
            id,
            Buffer.from(stringify(sortKeysRecursive(asset)))
        );

        return JSON.stringify(asset);
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

    async CastVote(ctx, tpsId, userId) {
        const tpsAsBytes = await ctx.stub.getState(tpsId);
        if (!tpsAsBytes || tpsAsBytes.length === 0) {
            throw new Error(`TPS with ID ${tpsId} does not exist`);
        }

        const tps = JSON.parse(tpsAsBytes.toString());

        const userIndex = tps.Users.findIndex(user => user.ID === userId);
        if (userIndex === -1) {
            throw new Error(`User ${userId} is not registered in TPS ${tpsId}`);
        }

        if (tps.Users[userIndex].HasVoted) {
            throw new Error(`User ${userId} has already voted`);
        }

        // Update user and TPS stats
        tps.Users[userIndex].HasVoted = true;
        tps.TotalVoted += 1;

        // Optionally: increment vote result (hardcoded for example)
        // tps.VoteResults.PaslonA += 1;

        // Save updated TPS
        await ctx.stub.putState(tpsId, Buffer.from(JSON.stringify(tps)));

        return JSON.stringify({
            message: `User ${userId} has voted at TPS ${tpsId}`,
            TotalVoted: tps.TotalVoted
        });
    }

    async UpdateVoteResults(ctx, tpsId, paslonA, paslonB) {
        const tpsAsBytes = await ctx.stub.getState(tpsId);
        if (!tpsAsBytes || tpsAsBytes.length === 0) {
            throw new Error(`TPS ${tpsId} not found`);
        }

        const tps = JSON.parse(tpsAsBytes.toString());

        tps.VoteResults = {
            PaslonA: parseInt(paslonA),
            PaslonB: parseInt(paslonB),
        };

        await ctx.stub.putState(tpsId, Buffer.from(JSON.stringify(tps)));
        return JSON.stringify(tps);
    }


}

module.exports = AssetTransfer;