const openpgp = require("openpgp");
const fs = require('fs');
var AdmZip = require('adm-zip');
const path = require('path');
const axios = require('axios');

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

exports.downloadKey = async (req, res) => {
    const { url } = req.body;
    if (url) {
        console.log('url to fetch', url)
        //clean Keys Folders
        if (fs.existsSync('./keys/keys.zip')) {
            fs.unlinkSync('./keys/keys.zip')
        };
        if (fs.existsSync('./keys/password.txt')) {
            fs.unlinkSync('./keys/password.txt');
        }
        if (fs.existsSync('./keys/public.txt')) {
            fs.unlinkSync('./keys/public.txt');
        }
        if (fs.existsSync('./keys/private.txt')) {
            fs.unlinkSync('./keys/private.txt');
        }
        if (fs.existsSync('./keys/_revokekey.txt')) {
            fs.unlinkSync('./keys/_revokekey.txt');
        }
        if (fs.existsSync('./keys/sharedUrl.txt')) {
            fs.unlinkSync('./keys/sharedUrl.txt');
        }
        // const data = await axios.get(url)
        await downloadFile(url, './keys/keys.zip')
        var zip = new AdmZip("./keys/keys.zip");
        zip.extractAllTo("./keys", true);

        console.log('downloadKeysFunction ok')
        res.status(200).send('ok')
    } else {
        res.status(504).send('provive url to fetch keys from')
    }

}

exports.uploadKey = async (req, res) => {
    const file = req.files.keyFile;
    if (file) {
        //clean Keys Folders
        if (fs.existsSync('./keys/keys.zip')) {
            fs.unlinkSync('./keys/keys.zip')
        };
        if (fs.existsSync('./keys/password.txt')) {
            fs.unlinkSync('./keys/password.txt');
        }
        if (fs.existsSync('./keys/public.txt')) {
            fs.unlinkSync('./keys/public.txt');
        }
        if (fs.existsSync('./keys/private.txt')) {
            fs.unlinkSync('./keys/private.txt');
        }
        if (fs.existsSync('./keys/_revokekey.txt')) {
            fs.unlinkSync('./keys/_revokekey.txt');
        }
        if (fs.existsSync('./keys/sharedUrl.txt')) {
            fs.unlinkSync('./keys/sharedUrl.txt');
        }
        await new Promise((success, reject) => {
            file.mv('./keys/keys.zip', async function (err) {
                console.log('uploaded')
                if (err) {
                    console.error('uploadIM file moved err:' + err);
                    reject(err);
                } else {
                    success();
                }
            });
        }).catch(e => {
            throw new Error(e);
        });
        var zip = new AdmZip("./keys/keys.zip");
        zip.extractAllTo("./keys", true);
        res.status(200).send('ok')
    } else {
        res.status(504).send('invalid key file')
    }

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

      

            //Delete existing
            if (fs.existsSync('./keys/keys.zip')) {
                fs.unlinkSync('./keys/keys.zip')
            };
            if (fs.existsSync('./keys/password.txt')) {
                fs.unlinkSync('./keys/password.txt');
            }
            if (fs.existsSync('./keys/public.txt')) {
                fs.unlinkSync('./keys/public.txt');
            }
            if (fs.existsSync('./keys/private.txt')) {
                fs.unlinkSync('./keys/private.txt');
            }
            if (fs.existsSync('./keys/_revokekey.txt')) {
                fs.unlinkSync('./keys/_revokekey.txt');
            }


            /*Safe encrypted NFT keys*/
            fs.writeFileSync('./keys/private.txt', privateKey); //GPG PRIVATE KEY
            fs.writeFileSync('./keys/password.txt', hash); // GPG PRIVATE KEY PASSWORD
            fs.writeFileSync('./keys/public.txt', publicKey); // PGP PUBLIC KEY
            fs.writeFileSync('./keys/_revokekey.txt', revocationCertificate); // GPG REVOKE KEY

            /* share public key */

            const publicKeyFile = fs.createReadStream("./keys/public.txt");
            const result = await ipfsApi.addFile(publicKeyFile);

            fs.writeFileSync('./keys/sharedUrl.txt', `${ipfsGatewayUri}/${result.Hash}`); // GPG REVOKE KEY

            var zip = new AdmZip();
            zip.addLocalFile('./keys/private.txt');
            zip.addLocalFile('./keys/password.txt');
            zip.addLocalFile('./keys/public.txt');
            zip.addLocalFile('./keys/_revokekey.txt');
            zip.addLocalFile('./keys/sharedUrl.txt');
            zip.writeZip("./keys/keys.zip");

            //in dev, upload
            const zipFile = fs.createReadStream("./keys/keys.zip");
            const resultPGP = await ipfsApi.addFile(zipFile);
            console.log('pgp ipfs: ', `${ipfsGatewayUri}/${resultPGP.Hash}`)

            console.log('NOTE: Keep your decryption key safe')

            let filePath = path.join(__dirname, `../../keys/keys.zip`);

            res.sendFile(filePath);
        
    } catch (err) {
        console.error(err);
    }
};

/////
//Share my public Key
/////

exports.getPublicKey = async (req, res) => {
    const publicKeyFile = fs.readFileSync('./keys/public.txt', 'utf8')
    res.status(200).send(publicKeyFile.toString())

}

/////
//Share my public Key
/////

exports.getPublicKeyURL = async (req, res) => {
    const publicKeyFile = fs.readFileSync('./keys/sharedUrl.txt', 'utf8')
    res.status(200).json({ publicKey: publicKeyFile.toString() })
}