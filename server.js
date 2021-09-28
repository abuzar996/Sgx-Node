const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const app = express();
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
cluster.schedulingPolicy = cluster.SCHED_RR;

// require('./app/scripts/initialize.script')();

const handleMaster = () => {
    let i = 0;
    while (i < numCPUs) {
        cluster.fork();
        i++;
    }
    cluster.on('exit', function (worker, code, signal) {
        // Restart the worker
        var worker = cluster.fork();

        // Note the process IDs
        var newPID = worker.process.pid;
        var oldPID = deadWorker.process.pid;

        // Log the event
        console.log('worker ' + oldPID + ' died.');
        console.log('worker ' + newPID + ' born.');
    });

    (async () => {
        if (!fs.existsSync('/usr/local/sgx-node-nfts'))
            fs.mkdirSync('/usr/local/sgx-node-nfts');

        if (!fs.existsSync('/usr/local/sgx-node-keys'))
            fs.mkdirSync('/usr/local/sgx-node-keys');

        if (!fs.existsSync('/usr/local/sgx-node-keys/private.txt'))
            console.warn('generate or download server keys')

    })();
}

const handleChild = () => {

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({
        extended: true
    }));

    app.use(fileUpload());

    require('./app/routes/nft.route')(app);
    require('./app/routes/keys.route')(app);

    const PORT = process.env.PORT || 3000;

    app.get('/', (req, res) => {
        res.send('server is running');
    });
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}.`);
    });
}

if (cluster.isMaster) {
    handleMaster();
} else {
    handleChild();
}