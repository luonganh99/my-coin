export default class Block {
    public index: number;
    public timestamp: number;
    public date: string;
    public transactions: Array<any>;
    public nonce: number;
    public hash: string;
    public previousBlockHash: string;

    constructor(
        index: number,
        timestamp: number,
        date: string,
        transactions: Array<any>,
        nonce: number,
        hash: string,
        previousBlockHash: string
    ) {
        this.index = index;
        this.timestamp = timestamp;
        this.date = date;
        this.transactions = transactions;
        this.nonce = nonce;
        this.hash = hash;
        this.previousBlockHash = previousBlockHash;
    }
}
