import { v4 as uuid } from 'uuid';

export default class Transaction {
    public transactionId: string;
    public amount: number;
    public sender: string;
    public recipient: string;
    public date: string;

    constructor(amount: number, sender: string, recipient: string) {
        this.transactionId = uuid().split('-').join('');
        this.amount = amount;
        this.sender = sender;
        this.recipient = recipient;
        this.date = new Date().toString();
    }
}
