export class BraceStack {
    protected stack: number;
    protected begin: string;
    protected end: string;

    constructor(begin: string, end: string) {
        this.stack = 0;

        this.begin = begin;
        this.end = end;
    }

    evalPush(c: string) {
        if (c === this.begin) {
            this.stack++;
        } else if (c === this.end) {
            this.stack--;
        }
    }

    len() {
        return this.stack;
    }
}

export class ClassBraceStack extends BraceStack {
    public className: string;

    constructor(begin: string, end: string) {
        super(begin, end);

        this.className = "";
    }

    evalPush(c: string) {
        if (c === this.begin) {
            this.stack++;
        } else if (c === this.end) {
            this.stack--;
        }

        if (this.stack === 0) {
            this.className = "";
        }
    }
}
