const openpgp = require("openpgp");
const fs = require('fs');
var AdmZip = require('adm-zip');
const path = require('path');
const axios = require('axios');
const KEYS_DIR_PATH = '/usr/local/sgx-node-keys/'

const {
    blake2AsHex
} = require('@polkadot/util-crypto');

const {
    TernoaIpfsApi
} = require('../helpers/ipfs.helper');
const { ipfsGatewayUri } = require('../helpers/ipfs.const');
const ipfsApi = new TernoaIpfsApi();

async function downloadFile(fileUrl, outputLocationPath) {
    const writer = fs.createWriteStream(outputLocationPath);

    return axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
    }).then(response => {

        //ensure that the user can call `then()` only when the file has
        //been downloaded entirely.

        return new Promise((resolve, reject) => {
            response.data.pipe(writer);
            let error = null;
            writer.on('error', err => {
                error = err;
                writer.close();
                reject(err);
            });
            writer.on('close', () => {
                if (!error) {
                    resolve(true);
                }
                //no need to call the reject here, as it will have been called in the
                //'error' stream;
            });
        });
    });
}

exports.generateKey = async (req, res) => {

    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < 20; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    const hash = blake2AsHex(result);

    try {
        /*generate pgp */
        const _pgp = await openpgp.generateKey({
            type: 'rsa',
            rsaBits: 2048,
            userIDs: [{
                name: 'yourname',
                email: 'johndoe@ternoa.com'
            }],
            // passphrase: hash
        });
        const {
            privateKey,
            publicKey,
            revocationCertificate
        } = _pgp;

        if (fs.existsSync(KEYS_DIR_PATH + 'private.txt')) {
            res.json("keys already created");
        } else {


            //Delete existing
            if (fs.existsSync(KEYS_DIR_PATH + 'keys.zip')) {
                fs.unlinkSync(KEYS_DIR_PATH + 'keys.zip')
            };
            if (fs.existsSync(KEYS_DIR_PATH + 'password.txt')) {
                fs.unlinkSync(KEYS_DIR_PATH + 'password.txt');
            }
            if (fs.existsSync(KEYS_DIR_PATH + 'public.txt')) {
                fs.unlinkSync(KEYS_DIR_PATH + 'public.txt');
            }
            if (fs.existsSync(KEYS_DIR_PATH + 'private.txt')) {
                fs.unlinkSync(KEYS_DIR_PATH + 'private.txt');
            }
            if (fs.existsSync(KEYS_DIR_PATH + '_revokekey.txt')) {
                fs.unlinkSync(KEYS_DIR_PATH + '_revokekey.txt');
            }


            /*Safe encrypted NFT keys*/
            fs.writeFileSync(KEYS_DIR_PATH + 'private.txt', privateKey); //GPG PRIVATE KEY
            fs.writeFileSync(KEYS_DIR_PATH + 'password.txt', hash); // GPG PRIVATE KEY PASSWORD
            fs.writeFileSync(KEYS_DIR_PATH + 'public.txt', publicKey); // PGP PUBLIC KEY
            fs.writeFileSync(KEYS_DIR_PATH + '_revokekey.txt', revocationCertificate); // GPG REVOKE KEY

            /* share public key */

            const publicKeyFile = fs.createReadStream(KEYS_DIR_PATH + "public.txt");
            const result = await ipfsApi.addFile(publicKeyFile);

            fs.writeFileSync(KEYS_DIR_PATH + 'sharedUrl.txt', `${ipfsGatewayUri}/${result.Hash}`); // GPG REVOKE KEY

            var zip = new AdmZip();
            zip.addLocalFile(KEYS_DIR_PATH + 'private.txt');
            zip.addLocalFile(KEYS_DIR_PATH + 'password.txt');
            zip.addLocalFile(KEYS_DIR_PATH + 'public.txt');
            zip.addLocalFile(KEYS_DIR_PATH + '_revokekey.txt');
            zip.addLocalFile(KEYS_DIR_PATH + 'sharedUrl.txt');
            zip.writeZip(KEYS_DIR_PATH + "keys.zip");

            //in dev, upload
            const zipFile = fs.createReadStream(KEYS_DIR_PATH + "keys.zip");
            // const resultPGP = await ipfsApi.addFile(zipFile);
            // console.log('pgp ipfs: ', `${ipfsGatewayUri}/${resultPGP.Hash}`)

            console.log('NOTE: Keep your decryption key safe')

            // let filePath = path.join(__dirname, `../../keys/keys.zip`);
            let filePath = KEYS_DIR_PATH + 'keys.zip'

            res.sendFile(filePath);
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('could not generate keys')
    }
};

/////
//Share my public Key
/////

exports.getPublicKey = async (req, res) => {
    try {
        const publicKeyFile = fs.readFileSync(KEYS_DIR_PATH + 'public.txt', 'utf8')
        res.status(200).send(publicKeyFile.toString())
    } catch (err) {
        res.status(424).send('Keys not found')
    }
}

/////
//Share my public Key
/////

exports.getPublicKeyURL = async (req, res) => {
    try {
        const publicKeyFile = fs.readFileSync(KEYS_DIR_PATH + 'sharedUrl.txt', 'utf8')
        res.status(200).json({ publicKey: publicKeyFile.toString() })
    } catch (err) {
        res.status(424).send('Keys not found')
    }
}