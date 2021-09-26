const {
    ApiPromise,
    WsProvider
} = require('@polkadot/api');
const {
    types
} = require('./types');
require('dotenv').config();

let api = null;
console.log('BLOCK_CHAIN_URL', process.env.BLOCK_CHAIN_URL)
async function getChainApiInstance() {
console.log('api instance')
    if (api && api.isConnected) {
        return api;
    } else {
        const provider = new WsProvider(process.env.BLOCK_CHAIN_URL);
        api = await ApiPromise.create({
            provider,
            types
        });
        return api;
    }
};
const safeDisconnectChainApi = async () => {
    if (api && api.isConnected) {
        await api.disconnect();
        api=null;
    }
};
module.exports = {
    getChainApiInstance,
    safeDisconnectChainApi
};