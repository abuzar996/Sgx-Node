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

const NFTS_DIR_PATH = '/usr/local/sgx-node-nfts/';
const KEYS_DIR_PATH = '/usr/local/sgx-node-keys/'

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
    let filePath = KEYS_DIR_PATH + 'public.txt'
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
    let filePath = KEYS_DIR_PATH + 'private.txt'
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


async function validateNFTOwnershipBatch(_data) {
    try {
        const chainApi = await getChainApiInstance();
        const data = _data.sssaShareData;
        const address = _data.accountPubKey;
        console.log('Address', address);
        let sgxData = []
        const nftIdsToCheck = Object.keys(data);
        console.log('nftIdsToCheck', nftIdsToCheck)
        let BCRequests = []
        for (let i = 0; i < nftIdsToCheck.length; i++) {
            BCRequests.push([chainApi.query.nfts.data, Number(nftIdsToCheck[i])])
        }
        let nftsData = await chainApi.queryMulti(BCRequests)
        for (let i = 0; i < nftsData.length; i++) {
            const NftDataString = JSON.parse(nftsData[i].toString());
            if (NftDataString.owner == address) {
                sgxData.push({ nftId: nftIdsToCheck[i], shamir: data[nftIdsToCheck[i]] })
            } else {
                sgxData.push({ nftId: nftIdsToCheck[i], shamir: false })
            }
        }
        return sgxData;
    }
    catch (err) {
        console.log('error validateNFTOwnershipBatch', err);
    }

}

exports.saveShamirBatch = async (req, res) => {
    const { sgxData } = req.body;
    const timestamp = new Date().getTime();
    // console.log('sgxData', sgxData)
    // console.time(`saveShamir_${timestamp}`);

    try {
        let decryptedData = await serverDecrypt(sgxData);
        // console.log('decryptedData', decryptedData)
        const { signature, data } = JSON.parse(decryptedData);
        const _data = JSON.parse(data);
        let successNFT = []
        let failedNFT = []
        // console.log('_data', _data)
        // console.time(`saveShamir_${timestamp}_validateAndGetData`);
        const isValidData = await isValidSignature(data, signature, _data.accountPubKey)
        if (isValidData) {
            // console.log('valid')
            const shamirData = await validateNFTOwnershipBatch(_data)
            // console.log('shamirData', shamirData)
            if (shamirData && shamirData.length > 0) {
                for (let i = 0; i < shamirData.length; i++) {
                    const _data = shamirData[i];
                    if (_data.shamir) {
                        try {
                            let encryptedShamir = await serverEncrypt(_data.shamir)
                            fs.writeFileSync(NFTS_DIR_PATH + `${_data.nftId}.txt`, encryptedShamir);
                            successNFT.push(_data.nftId)
                        } catch (error) {
                            console.log('error writing shamir', _data);
                            console.log('error ->', error);
                            failedNFT.push(_data.nftId)
                        }
                    } else {
                        failedNFT.push(_data.nftId)
                    }
                }
            }

            res.status(200).json({ successNFT, failedNFT })

        } else {
            console.log('invalid data')
            res.status(401).send('invalid signature')
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
        // console.timeEnd(`saveShamir_${timestamp}`);
    }
};

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
            fs.writeFileSync(NFTS_DIR_PATH + `${nftId}.txt`, encryptedShamir);
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
            const result = fs.readFileSync(NFTS_DIR_PATH + `${nftId}.txt`);
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