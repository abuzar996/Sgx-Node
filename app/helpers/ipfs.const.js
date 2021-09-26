const ipfsNodes = {
    ternoaIpfsBaseUrl: `https://ipfs.ternoa.dev`
}
const ipfsBaseUrl = process.env.IPFS_BASEURL || ipfsNodes.ternoaIpfsBaseUrl;
const ipfsGatewayUri = `${ipfsBaseUrl}/ipfs`;
exports.ipfsBaseUrl = ipfsBaseUrl; 
exports.ipfsGatewayUri = ipfsGatewayUri;
