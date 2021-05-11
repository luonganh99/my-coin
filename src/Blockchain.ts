import { v4 as uuid } from 'uuid';
import sha256 from 'sha256';
import Block from './Block';
const currentNodeUrl = process.env.URL || process.argv[3];

export default class Blockchain {
    public socketId: string;
    public chain: Array<any>;
    public pendingTransactions: Array<any>;
    public transactions: Array<any>;
    public networkNodes: Array<any>;
    public currentNodeUrl: any;

    constructor(socketId = '') {
        this.socketId = socketId;
        this.chain = [];
        this.pendingTransactions = [];
        this.transactions = [];
        this.currentNodeUrl = currentNodeUrl;
        this.networkNodes = []; // TODO: weird?
        this.createNewBlock(100, '0', '0', []);
    }

    public createNewBlock(
        nonce: number,
        previousBlockHash: string,
        hash: string,
        transactions: any
    ) {
        const newBlock = new Block(
            this.chain.length + 1,
            Date.now(),
            new Date().toString(),
            transactions,
            nonce,
            hash,
            previousBlockHash
        );
        this.pendingTransactions = [];
        this.chain.push(newBlock);
        return newBlock;
    }

    public createNewBlockWithoutAdd(
        nonce: number,
        previousBlockHash: string,
        hash: string,
        transactions: any
    ) {
        const newBlock = new Block(
            this.chain.length + 1,
            Date.now(),
            new Date().toString(),
            transactions,
            nonce,
            hash,
            previousBlockHash
        );
        return newBlock;
    }

    public getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    public createNewTransaction(amount: number, sender: any, recipient: any) {
        const newTransaction = {
            transactionId: uuid().split('-').join(''),
            amount: amount,
            date: new Date(),
            sender: sender,
            recipient: recipient,
        };

        return newTransaction;
    }

    public addTransactionToPendingTransactions(transactionObject: any) {
        this.pendingTransactions.push(transactionObject);
        return this.getLastBlock()['index'] + 1;
    }

    public proofOfWork(previousBlockHash: string, currentBlockData: any) {
        let nonce = 0;
        let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        while (hash.substring(0, 4) !== '0000') {
            nonce++;
            hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        }
        return nonce;
    }

    public hashBlock(previousBlockHash: any, currentBlockData: any, nonce: number) {
        const dataAsString =
            previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
        const hash = sha256(dataAsString);
        return hash;
    }

    public chainIsValid(blockchain: Array<any>) {
        // TODO: change
        let validChain = true;

        for (var i = 1; i < blockchain.length; i++) {
            const currentBlock = blockchain[i];
            const prevBlock = blockchain[i - 1];
            const blockHash = this.hashBlock(
                prevBlock['hash'],
                { transactions: currentBlock['transactions'], index: currentBlock['index'] },
                currentBlock['nonce']
            );
            if (blockHash.substring(0, 4) !== '0000') validChain = false;
            if (currentBlock['previousBlockHash'] !== prevBlock['hash']) validChain = false;
        }

        //check genesis block validation
        const genesisBlock = blockchain[0];
        const correctNonce = genesisBlock['nonce'] === 100;
        const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === '0';
        const correctHash = genesisBlock['hash'] === '0';
        const correctTransactions = genesisBlock['transactions'].length === 0;

        if (!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions)
            validChain = false;

        return validChain;
    }

    public getBlock(blockHash: string) {
        let correctBlock = null;
        this.chain.forEach((block) => {
            if (block.hash === blockHash) correctBlock = block;
        });
        return correctBlock;
    }

    public getTransaction(transactionId: any) {
        let correctTransaction = null;
        let correctBlock = null;

        this.chain.forEach((block) => {
            block.transactions.forEach((transaction: any) => {
                if (transaction.transactionId === transactionId) {
                    correctTransaction = transaction;
                    correctBlock = block;
                }
            });
        });

        return {
            transaction: correctTransaction,
            block: correctBlock,
        };
    }

    public getPendingTransactions() {
        return this.pendingTransactions;
    }

    public getAddressData(address: any): any {
        const addressTransactions: Array<any> = [];
        this.chain.forEach((block) => {
            block.transactions.forEach((transaction: any) => {
                if (transaction.sender === address || transaction.recipient === address) {
                    addressTransactions.push(transaction); //push all tranasction by sender or recipient into array.
                }
            });
        });

        if (addressTransactions == null) {
            return false;
        }

        var amountArr: Array<number> = [];

        let balance = 0;
        addressTransactions.forEach((transaction) => {
            if (transaction.recipient === address) {
                balance += transaction.amount;
                amountArr.push(balance);
            } else if (transaction.sender === address) {
                balance -= transaction.amount;
                amountArr.push(balance);
            }
        });

        return {
            addressTransactions: addressTransactions,
            addressBalance: balance,
            amountArr: amountArr,
        };
    }
}
