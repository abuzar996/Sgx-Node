const fs = require('fs');
const path = require('path');

exports.writeNft = async (req, res) => {
    const { nftId, field } = req.body;

    try {
        let filePath = path.join(__dirname, `../nft/`);

        fs.writeFileSync(filePath + `${nftId}.txt`, field);

        res.status(200).send('Added Succesfully')
    } catch (err) {
        res.status(505).send(err.message);
    }
};

exports.readNft = async (req, res) => {
    try {
        let filePath = path.join(__dirname, `../nft/`);

        const result = fs.readFileSync(filePath + `${req.query.nftId}.txt`);

        res.status(200).send(result.toString());
    } catch (err) {
        console.log(err)
        res.status(505).send(err.message);
    }
};