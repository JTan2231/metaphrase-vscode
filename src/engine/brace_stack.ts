export class BraceStack {
    protected stack: number;
    protected begin: string;
    protected end: string;
    public quote: string;
    public escape: boolean;

    constructor(begin: string, end: string) {
        this.stack = 0;

        this.begin = begin;
        this.end = end;

        this.quote = "";
        this.escape = false;
    }

    // flow:
    //   - if we're escaped, ignore
    //   - if we're entering or exiting quotes, adjust scope
    //   - otherwise continue standard scope change
    evalPush(c: string) {
        if (this.escape) {
            this.escape = false;
        } else if (c === this.quote) {
            this.quote = "";
        } else if (this.quote === "") {
            if (c === '"' || c === "'") {
                this.quote = c;
            } else if (c === this.begin) {
                this.stack++;
            } else if (c === this.end) {
                this.stack--;
            }
        } else if (!this.escape && c === "\\") {
            this.escape = true;
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
        if (this.className !== "") {
            super.evalPush(c);

            if (this.stack === 0) {
                this.className = "";
            }
        }
    }
}

function findMatch(c: string, array: Array<string>): boolean {
    for (const s of array) {
        if (c === s) {
            return true;
        }
    }

    return false;
}

function top(array: Array<string>): string {
    return array.length > 0 ? array[array.length - 1] : "";
}

// for C-esque languages
export class BracedScopeManager {
    private stack: Array<string>;

    private multi = "";

    public classStart = 0;
    public currentClass = "";

    public functionStart = 0;
    public currentFunction = "";

    public inClass = false;
    public inFunction = false;

    public resetFunctionCallback = () => {};

    private beginSet = ["(", "[", "{", `"`, `'`, "`"];

    private endSet = new Map<string, string>([
        ["(", ")"],
        ["{", "}"],
        ["[", "]"],
        [`"`, `"`],
        [`'`, `'`],
        ["`", "`"]
    ]);

    private multiCharacterSet = ["/", "*", "//", "/*", "*/"];

    constructor() {
        this.stack = new Array<string>();
    }

    lineBreak() {
        if (top(this.stack) === "//") {
            this.stack.pop();
        }
    }

    length(): number {
        return this.stack.length;
    }

    top(): string {
        return top(this.stack);
    }

    isQuote(c: string): boolean {
        return c === `"` || c === `'` || c === "`";
    }

    inQuote(): boolean {
        return this.isQuote(this.top());
    }

    inComment(): boolean {
        const top = this.top();
        return top === "//" || top === "/*";
    }

    setClass(className: string) {
        this.classStart = Math.max(0, this.stack.length - 1);
        this.currentClass = className;
        this.inClass = true;
    }

    setFunction(functionSignature: string) {
        this.functionStart = Math.max(0, this.stack.length - 1);
        this.currentFunction = functionSignature;
        this.inFunction = true;
    }

    resetClass() {
        this.classStart = 0;
        this.currentClass = "";
        this.inClass = false;
    }

    resetFunction() {
        this.functionStart = 0;
        this.currentFunction = "";
        this.inFunction = false;
    }

    push(c: string) {
        const last = top(this.stack);
        const m = this.multi + c;

        if (!this.isQuote(last)) {
            // is this the start of any multi-character scope?
            if (this.multiCharacterSet.includes(m)) {
                if (m.length === 2 && m !== "*/") {
                    this.stack.push(m);
                    this.multi = "";
                }
                // end multi-line comment
                else if (m === "*/") {
                    this.stack.pop();
                } else {
                    this.multi = m;
                }

                return;
            }
            // if not, reset this.multi
            else {
                this.multi = "";
            }
        }

        // ignore whatever character is escaped
        if (last === "\\") {
            this.stack.pop();
        }
        // if we're in a quote, ignore everything until we're at the end of the quote
        else if (this.isQuote(last)) {
            if (c === last) {
                this.stack.pop();
            }
        }
        // ignore everything on single-line comments
        else if (last === "//") {
            return;
        }
        // if we're in a multiline comment, ignore everything until we're at the end of the comment
        else if (last === "/*") {
            if (m === "*/") {
                this.stack.pop();
            }
        }
        // if we're not in a comment, evaluate the character
        // otherwise, ignore everything until we reach the end of the line
        // (when this.lineBreak() is called)
        //
        // note: this condition is true only when we're NOT in a comment AND NOT in a quote AND NOT escaped
        else {
            if (this.beginSet.includes(last)) {
                if (c === this.endSet.get(last)) {
                    const popped = this.stack.pop();

                    if (this.inClass && this.stack.length === this.classStart && popped === "{") {
                        this.resetClass();
                    } else if (this.inFunction && this.stack.length === this.functionStart && popped === "{") {
                        this.resetFunction();
                        this.resetFunctionCallback();
                    }

                    return;
                }
            }

            if (this.beginSet.includes(c)) {
                this.stack.push(c);
            } else if (this.isQuote(c)) {
                this.stack.push(c);
            } else if (this.multiCharacterSet.includes(c)) {
                if (m.length === 1) {
                    this.multi = m;
                }
            }
        }
    }
}
