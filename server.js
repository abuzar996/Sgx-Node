const express = require('express');
const cors = require('cors');

const app = express();

require('./app/scripts/ip.script')();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.status(200).send('Api is running');
});

require('./app/routes/nft.route')(app);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('Api is running');
})