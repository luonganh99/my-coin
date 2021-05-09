import express from 'express';
import sha256 from 'sha256';
import axios from 'axios';
import forge from 'node-forge';
import hdkey from 'hdkey';
const bip39 = require('bip39');
import cors from 'cors';
require('dotenv').config();

import Blockchain from './Blockchain';
const app = express();
app.use(cors());
app.use(express.json());

const MyCoin = new Blockchain();
const seed = bip39.mnemonicToSeedSync(
    'pizza hero sister arrow square village chronic special vendor castle smooth device'
);
const root = hdkey.fromMasterSeed(seed);
const privateKey = root.privateKey.toString('hex');
const publicKey = root.publicKey.toString('hex');

const master = MyCoin.createNewTransaction(1000000, 'system-reward', publicKey);

MyCoin.chain[0].transactions.push(master); // First transaction at first block
const port = process.env.PORT || process.argv[2];

const server = app.listen(port, () => {
    console.log('Server is running at port', port);
});

const nodes: any = [];
const io = require('socket.io')(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ['GET', 'POST'],
        allowedHeaders: ['my-custom-header'],
        credentials: true,
    },
});

io.on('connection', (socket: any) => {
    nodes.push(new Blockchain(socket.id));
    socket.emit('PT', MyCoin.pendingTransactions);
    console.log('New user connected');
    console.log(socket.id);

    app.post('/transaction/broadcast', (req: any, res: any) => {
        const amount = parseFloat(req.body.amount);
        // weird ???
        const newTransaction = nodes[nodes.length - 1].createNewTransaction(
            amount,
            req.body.sender,
            req.body.recipient
        );
        let flag = true;
        let sender = req.body.sender;

        /*  -Authentication: check for valid private key-  */
        if (
            sender !== 'system-reward' &&
            sender !== 'system-reward: new user' &&
            sender !== 'system-reward: invitation confirmed'
        ) {
            /*  -Authentication: check if user have the require amount of coins for current transaction && if user exist in the blockchain-  */
            const addressDataOfSender = MyCoin.getAddressData(req.body.sender);
            // const addressDataOfRecipient = MyCoin.getAddressData(req.body.recipient);
            if (
                addressDataOfSender.addressBalance < amount ||
                addressDataOfSender === false
                // addressDataOfRecipient === false
            ) {
                flag = false;
                res.json({
                    note: false,
                });
            }
            /*  -Authentication: fields cannot be empty-  */
            if (
                req.body.amount.length === 0 ||
                amount === 0 ||
                amount < 0 ||
                req.body.sender.length === 0 ||
                req.body.recipient.length === 0
            ) {
                flag = false;
                res.json({
                    note: false,
                });
            }
        }

        if (amount > 0 && flag === true) {
            var pt = null;
            MyCoin.addTransactionToPendingTransactions(newTransaction); //put new transaction in global object
            nodes.forEach((socketNode: any) => {
                socketNode.addTransactionToPendingTransactions(newTransaction);
                // io.sockets[socketNode.socketId.toString()].pendingTransactions =
                //     socketNode.pendingTransactions; //add property to socket
                pt = socketNode.pendingTransactions;
            });
            io.emit('PT', pt); //emit to all sockets
            res.json({
                note: `Transaction complete!`,
            });
        }
    });

    app.post('/mine', (req: any, res: any) => {
        const { clientHdKey } = req.body;
        const root = hdkey.fromJSON(clientHdKey);
        const publicKey = root.publicKey.toString();

        const lastBlock = MyCoin.getLastBlock();
        const previousBlockHash = lastBlock['hash'];

        const currentBlockData = {
            transactions: [
                ...MyCoin.pendingTransactions,
                MyCoin.createNewTransaction(12.5, 'system-reward', publicKey),
            ],
            index: lastBlock['index'] + 1,
        };

        const nonce = MyCoin.proofOfWork(previousBlockHash, currentBlockData); //doing a proof of work (maybe currentBlockData.transactions)
        const blockHash = MyCoin.hashBlock(previousBlockHash, currentBlockData, nonce); //hash the block
        const newBlock = MyCoin.createNewBlock(
            nonce,
            previousBlockHash,
            blockHash,
            currentBlockData.transactions
        ); //create a new block with params

        axios
            .post(MyCoin.currentNodeUrl + '/receive-new-block', {
                newBlock,
            })
            .then(() => {
                res.json({
                    note: 'New block mined and broadcast successfully',
                    block: newBlock,
                });
            });
    });

    // Check validity of new block
    // TODO: Too simple ?
    app.post('/receive-new-block', (req, res) => {
        const newBlock = req.body.newBlock;
        const lastBlock = MyCoin.getLastBlock();
        const correctHash = lastBlock.hash === newBlock.previousBlockHash;
        const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

        if (correctHash && correctIndex) {
            MyCoin.chain.push(newBlock);
            MyCoin.pendingTransactions = [];
            res.json({
                note: 'New block received and accepted.',
                newBlock: newBlock,
            });
        } else {
            res.json({
                note: 'New block rejected',
                newBlock: newBlock,
            });
        }
    });

    app.get('/emitMiningSuccess', (req, res) => {
        io.emit('mineSuccess', true); //emit to all sockets
    });

    app.get('/pendingTransactions', (req, res) => {
        const transactionsData = MyCoin.getPendingTransactions();
        res.json({
            pendingTransactions: transactionsData,
        });
    });

    app.get('/blockchain', (req, res) => {
        res.send(MyCoin);
    });

    const keyPair = forge.pki.rsa.generateKeyPair(1024);
    app.get('/generateKeyPair', (req, res) => {
        res.send(keyPair.publicKey);
    });

    app.post('/hashKeys', (req, res) => {
        // k1: private key
        // k2: public key
        const k1 = req.body.key1;

        //const k1 = keyPair.privateKey.decrypt(req.body.k1);
        //console.log(k1);

        const k2 = req.body.key2;
        const privateKey_Is_Valid = sha256(k1) === k2;

        const addressData = MyCoin.getAddressData(k2);
        if (addressData === false) {
            res.json({
                note: false,
            });
        } else if (!privateKey_Is_Valid) {
            res.json({
                note: false,
            });
        } else {
            res.json({
                note: true,
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User: ${socket.id} was disconnected`);
        nodes.splice(search(socket.id.toString(), nodes), 1);
    });
});

function search(nameKey: any, myArray: any) {
    for (var i = 0; i < myArray.length; i++) {
        if (myArray[i].socketId === nameKey) {
            return i;
        }
    }
}

app.get('/generateMnemoricPhrase', async (req, res) => {
    const mnemonic = bip39.generateMnemonic();

    return res.json({
        mnemonic,
    });
});

app.post('/validateMnemoricPhrase', async (req, res) => {
    const isVerifed = bip39.validateMnemonic(req.body.mnemoric);
    if (!isVerifed) {
        return res.json({
            note: false,
        });
    }

    const seed = await bip39.mnemonicToSeed(req.body.mnemoric);
    const root = hdkey.fromMasterSeed(seed);
    return res.json({
        hdkey: root.toJSON(),
        publicKey: root.publicKey.toString('hex'),
    });
});

app.get('/blockchain', (req, res) => {
    res.json(MyCoin);
});

/*  -get block by blockHash-  */
app.get('/block/:blockHash', (req, res) => {
    const blockHash = req.params.blockHash;
    const correctBlock = MyCoin.getBlock(blockHash);
    res.json({
        block: correctBlock,
    });
});

/*  -get transaction by transactionId-  */
app.get('/transaction/:transactionId', (req, res) => {
    const transactionId = req.params.transactionId;
    const trasactionData = MyCoin.getTransaction(transactionId);
    res.json({
        transaction: trasactionData.transaction,
        block: trasactionData.block,
    });
});

/*  -get address by address-  */
app.get('/address/:address', (req, res) => {
    const address = req.params.address;
    const addressData = MyCoin.getAddressData(address);
    res.json({
        addressData: addressData,
    });
});
