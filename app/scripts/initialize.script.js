const argv = require('minimist')(process.argv.slice(2));
const { Keyring } = require('@polkadot/keyring');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function initialize() {
    console.log('argv', argv);
    await cryptoWaitReady();
    //keyring
    //polka api

    /*check if user exists on sgx
    yes-> check if 
    */
}

module.exports = initialize;