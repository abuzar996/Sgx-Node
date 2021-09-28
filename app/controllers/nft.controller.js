const fs = require('fs');
const path = require('path');
const openpgp = require("openpgp");
const { getChainApiInstance, safeDisconnectChainApi } = require('../polka/index.js');
const {
    signatureVerify,
    decodeAddress,
} = require('@polkadot/util-crypto');

const {
    u8aToHex
} = require('@polkadot/util');

const dirPath = './nfts/';

async function _encrypt(data, key) {
    const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: data }),
        encryptionKeys: (await openpgp.readKey({
            armoredKey: key
        })),
    });
    return encrypted
}

async function serverEncrypt(data, key) {
    let filePath = path.join(__dirname, "../../keys/public.txt");
    const serverKey = fs.readFileSync(filePath);
    const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: data }),
        encryptionKeys: (await openpgp.readKey({
            armoredKey: serverKey.toString()
        })),
    });
    return encrypted
}

async function serverDecrypt(data) {
    let filePath = path.join(__dirname, "../../keys/private.txt");
    const privateKeyText = fs.readFileSync(filePath);
    const privateKey = await openpgp.readKey({
        armoredKey: privateKeyText.toString()
    })
    const decrypted = await openpgp.decrypt({
        message: await openpgp.readMessage({
            armoredMessage: data
        }).catch(e => {
            throw new Error(`openpgp.readMessage error: ${e}`)
        }),
        decryptionKeys: [privateKey],
    })
    if (decrypted && decrypted.data)
        return decrypted.data;
    else
        throw new Error('invalid sgxData')
}

async function getNFTOwner(nftId) {
    try {
        const chainApi = await getChainApiInstance();
        const nftData = await chainApi.query.nfts.data(nftId);
        // safeDisconnectChainApi(); //no need to disconnect, we can afford 8 socket connection to chain all the time to increase speed of operations
        const owner = String(nftData.owner);
        console.log('nftId', nftId, '--owenr:', owner);
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
            console.log('invalid owner, nftid:', nftId, '--requesterAddress:', requesterAddress)
            throw new Error('invalid owner')
        }
    } else {
        //invalid signature
        throw new Error('invalid signature')
    }
}

exports.saveShamir = async (req, res) => {
    const { sgxData } = req.body;
    const timestamp = new Date().getTime();
    console.time(`saveShamir_${timestamp}`);

    try {
        let decryptedData = await serverDecrypt(sgxData);
        // console.log('decryptedData', decryptedData)
        const { signature, data } = JSON.parse(decryptedData);
        console.time(`saveShamir_${timestamp}_validateAndGetData`);
        const { nftId, shamir } = await validateAndGetData(data, signature);
        console.timeEnd(`saveShamir_${timestamp}_validateAndGetData`);
        if (shamir) {
            console.time(`saveShamir_${timestamp}_writeFileSync`);
            let encryptedShamir = await serverEncrypt(shamir)
            fs.writeFileSync(dirPath + `${nftId}.txt`, encryptedShamir);
            console.timeEnd(`saveShamir_${timestamp}_writeFileSync`);
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
    finally {
        console.timeEnd(`saveShamir_${timestamp}`);
    }
};

exports.getShamir = async (req, res) => {
    const { signature, data, key } = req.body;
    try {
        const { nftId, shamir } = await validateAndGetData(data, signature);
        if (shamir == 'getData') {
            const result = fs.readFileSync(dirPath + `${nftId}.txt`);
            // console.log('result', result.toString())
            const serverDecryptedShamir = await serverDecrypt(result.toString())
            const encryptedShamir = await _encrypt(serverDecryptedShamir, key);
            res.status(200).json({ encryptedShamir });
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