const fs = require('fs');
const path = require('path');
const getChainApiInstance = require('../polka/index.js');
const {
    signatureVerify,
    decodeAddress,
} = require('@polkadot/util-crypto');

const {
    u8aToHex
} = require('@polkadot/util');

const dirPath = './nfts/';

async function getNFTOwner(nftId) {
    try {
        const chainApi = await getChainApiInstance();
        const nftData = await chainApi.query.nfts.data(nftId);
        const owner = String(nftData.owner);
        console.log('owenr:', owner);
        return owner
    } catch (err) {
        console.log('getNFTOwner err: ', err)
        return false;
    }
}

async function validateNFTOwnership(nftId, requestAddress) {
    const nftOwner = await getNFTOwner(nftId)
    if (nftOwner && nftOwner === requestAddress)
        return true;
    return false;
}

const isValidSignature = (
    signedMessage, signature, address) => {
    const publicKey = decodeAddress(address);
    const hexPublicKey = u8aToHex(publicKey);
    return signatureVerify(signedMessage, signature, hexPublicKey).isValid;
};

async function validateAndGetData(data, signature) {
    const dataContent = data.split('_');
    const nftId = dataContent[0]
    const requesterAddress = dataContent[1];

    const isValid = isValidSignature(data, signature, requesterAddress);
    if (isValid) {
        const isValidOwner = await validateNFTOwnership(nftId, requesterAddress)
        if (isValidOwner) {
            let returnData = {
                nftId
            }
            if (dataContent[2]) {
                returnData.shamir = dataContent[2]
            }
            return returnData
        } else {
            throw new Error('invalid owner')
        }
    } else {
        //invalid signature
        throw new Error('invalid signature')
    }
}

exports.saveShamir = async (req, res) => {
    const { signature, data } = req.body;

    try {
        const { nftId, shamir } = await validateAndGetData(data, signature);
        if (shamir) {
            fs.writeFileSync(dirPath + `${nftId}.txt`, shamir);
            res.status(200).send(`${nftId}`)
        } else {
            res.status(400).send('shamir not found');
        }
    } catch (err) {
        if (err.message == 'invalid owner')
            res.status(423).send(err.message);
        else if (err.message == 'invalid signature')
            res.status(401).send(err.message);
        else
            res.status(500).send(err.message);
    }
};

exports.getShamir = async (req, res) => {
    const { signature, data } = req.body;
    try {
        const { nftId, shamir } = await validateAndGetData(data, signature);
        if (shamir == 'getData') {
            const result = fs.readFileSync(dirPath + `${nftId}.txt`);

            res.status(200).json({ shamir: result.toString() });
        } else {
            res.status(423).send('invalid request parameter');
        }

    } catch (err) {
        if (err.message == 'invalid owner')
            res.status(423).send(err.message);
        else if (err.message == 'invalid signature')
            res.status(401).send(err.message);
        else
            res.status(503).send(err.message);
    }
};