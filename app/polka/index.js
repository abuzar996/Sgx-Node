const { ApiPromise, WsProvider } = require('@polkadot/api');
const { types } = require('./types');
const argv = require('minimist')(process.argv.slice(2));

let api = null;
const provider = new WsProvider(argv.BLOCK_CHAIN_URL || 'wss://dev.chaos.ternoa.com');
module.exports = async function getChainApiInstance() {
    if (api && api.isConnected) {
        return api;
    } else {
        api = await ApiPromise.create({ provider, types });
        return api;
    }
};