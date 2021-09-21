const { ApiPromise, WsProvider } = require('@polkadot/api');
const { types } = require('./types');
require('dotenv').config();

let api = null;
const provider = new WsProvider(process.env.BLOCK_CHAIN_URL);
console.log('BLOCK_CHAIN_URL',process.env.BLOCK_CHAIN_URL)
module.exports = async function getChainApiInstance() {
    
    if (api && api.isConnected) {
        return api;
    } else {
        api = await ApiPromise.create({ provider, types });
        return api;
    }
};