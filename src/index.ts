import express from 'express';
import axios from 'axios';
import hdkey from 'hdkey';
import cors from 'cors';
const bip39 = require('bip39');
require('dotenv').config();

import Blockchain from './Blockchain';

const app = express();
app.use(cors());
app.use(express.json());

const CryptCoin = new Blockchain();

const genesisBlock = async () => {
    const seed = await bip39.mnemonicToSeed(
        'vendor gown broom sugar guard beef say aim whip trade paddle noise'
    );
    const root = hdkey.fromMasterSeed(seed);
    const publicKey = root.publicKey.toString('hex');

    const master = CryptCoin.createNewTransaction(1000000, 'system-reward', publicKey);
    CryptCoin.transactions.push(master);
    CryptCoin.chain[0].transactions.push(master); // First transaction at first block
};

genesisBlock();

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
    socket.emit('PT', CryptCoin.pendingTransactions);
    console.log('New user connected');
    console.log(socket.id);

    app.post('/transaction/broadcast', (req: any, res: any) => {
        const amount = parseFloat(req.body.amount);
        const newTransaction = nodes[nodes.length - 1].createNewTransaction(
            amount,
            req.body.sender,
            req.body.recipient
        );
        let flag = true;
        let sender = req.body.sender;

        if (sender !== 'system-reward') {
            const addressDataOfSender = CryptCoin.getAddressData(req.body.sender);
            if (addressDataOfSender.addressBalance < amount || addressDataOfSender === false) {
                flag = false;
                res.json({
                    note: false,
                });
            }

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
            CryptCoin.addTransactionToPendingTransactions(newTransaction);
            nodes.forEach((socketNode: any) => {
                socketNode.addTransactionToPendingTransactions(newTransaction);
                pt = socketNode.pendingTransactions;
            });
            io.emit('PendingTransaction', pt);
            res.json({
                note: `Transaction complete!`,
            });
        }
    });

    app.post('/mine', (req: any, res: any) => {
        const { clientHdKey } = req.body;

        const root = hdkey.fromJSON(clientHdKey);
        const publicKey = root.publicKey.toString('hex');

        const lastBlock = CryptCoin.getLastBlock();
        const previousBlockHash = lastBlock['hash'];

        const currentBlockData = {
            transactions: [
                ...CryptCoin.pendingTransactions,
                CryptCoin.createNewTransaction(12.5, 'system-reward', publicKey),
            ],
            index: lastBlock['index'] + 1,
        };

        const nonce = CryptCoin.proofOfWork(previousBlockHash, currentBlockData);
        const blockHash = CryptCoin.hashBlock(previousBlockHash, currentBlockData, nonce);
        const newBlock = CryptCoin.createNewBlockWithoutAdd(
            nonce,
            previousBlockHash,
            blockHash,
            currentBlockData.transactions
        );

        axios
            .post(CryptCoin.currentNodeUrl + '/receive-new-block', {
                newBlock,
            })
            .then((response: any) => {
                if (response.data.note) {
                    res.json({
                        note: true,
                        block: newBlock,
                    });
                    io.emit('PendingTransaction', CryptCoin.pendingTransactions);
                    io.emit('Trasactions', CryptCoin.transactions);
                    io.emit('Blocks', CryptCoin.chain);
                    console.log('okeee');
                    return;
                }
            });
    });

    app.post('/receive-new-block', (req, res) => {
        const newBlock = req.body.newBlock;
        const lastBlock = CryptCoin.getLastBlock();
        const correctHash = lastBlock.hash === newBlock.previousBlockHash;
        const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

        if (correctHash && correctIndex) {
            CryptCoin.chain.push(newBlock);
            CryptCoin.pendingTransactions = [];
            CryptCoin.transactions = CryptCoin.transactions.concat(newBlock.transactions);

            res.json({
                note: true,
                newBlock: newBlock,
            });
        } else {
            res.json({
                note: false,
                newBlock: newBlock,
            });
        }
    });

    app.get('/emitMiningSuccess', (req, res) => {
        io.emit('mineSuccess', true); //emit to all sockets
    });

    app.get('/pendingTransactions', (req, res) => {
        const transactionsData = CryptCoin.getPendingTransactions();
        res.json({
            pendingTransactions: transactionsData,
        });
    });

    app.get('/blockchain', (req, res) => {
        res.send(CryptCoin);
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

app.get('/generateMnemonicPhrase', async (req, res) => {
    const mnemonic = bip39.generateMnemonic();

    return res.json({
        mnemonic,
    });
});

app.post('/validateMnemonicPhrase', async (req, res) => {
    const isVerifed = bip39.validateMnemonic(req.body.mnemonic);
    if (!isVerifed) {
        return res.json({
            note: false,
        });
    }

    const seed = await bip39.mnemonicToSeed(req.body.mnemonic);
    const root = hdkey.fromMasterSeed(seed);
    return res.json({
        hdKey: root.toJSON(),
        publicKey: root.publicKey.toString('hex'),
        note: true,
    });
});

app.get('/blockchain', (req, res) => {
    res.json(CryptCoin);
});

app.get('/address/:address', (req, res) => {
    const address = req.params.address;
    const addressData = CryptCoin.getAddressData(address);
    res.json({
        addressData: addressData,
    });
});
