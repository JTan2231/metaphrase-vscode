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

export class PythonScopeManager {
    private stack: Array<string>;
    private scopeNameStack: Map<string, string>;

    public currentScope = 0;
    private buildingScope = true;
    private pendingNewScope = false;

    public classStart = 0;
    public currentClass = "";

    public functionStart = 0;
    public currentFunction = "";

    public inClass = false;
    public inFunction = false;

    public resetFunctionCallback = () => {};
    public newScopeCallback = () => {};

    // the only meaningful scope changes here come after :
    // colons inside brackets need to be ignored
    private beginSet = ["[", "{", "(", `"`, `'`];

    private endSet = new Map<string, string>([
        ["(", ")"],
        ["{", "}"],
        ["[", "]"],
        [`"`, `"`],
        [`'`, `'`]
    ]);

    constructor() {
        this.stack = new Array<string>();
        this.scopeNameStack = new Map<string, string>();
    }

    lineBreak() {
        if (top(this.stack) === "#") {
            this.stack.pop();
        }

        if (this.pendingNewScope) {
            this.stack.push(String(this.currentScope));
            this.newScopeCallback();
        }

        this.buildingScope = !this.beginSet.includes(this.top());
        this.currentScope = this.beginSet.includes(this.top()) ? this.currentScope : 0;
    }

    addNamedScope(name: string) {
        this.scopeNameStack.set(String(this.currentScope), name);
    }

    getNamedScope() {
        return [...this.scopeNameStack]
            .sort((x, y) => Number(x[0]) - Number(y[0]))
            .map((x) => x[1])
            .join(".");
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
        return top === "#";
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
        this.functionStart = -1;
        this.currentFunction = "";
        this.inFunction = false;
    }

    push(c: string) {
        const last = top(this.stack);

        if (c === "#") {
            this.stack.push(c);
        } else if (this.isQuote(last)) {
            if (c === last) {
                this.stack.pop();
            }
        }
        // ignore everything on single-line comments
        else if (last === "#") {
            return;
        }
        // NOT in a quote AND NOT in a comment
        // scope change isn't relevant here if we're in brackets
        else if (this.buildingScope && !this.beginSet.includes(last)) {
            if (c === " ") {
                this.currentScope++;
            } else {
                this.buildingScope = false;
            }
        }
        // new scope is established--check if we're in brackets
        else {
            if (this.beginSet.includes(last)) {
                if (c === this.endSet.get(last)) {
                    this.stack.pop();
                }
            }
            // not in brackets--check if this is a colon
            else if (c === ":") {
                this.pendingNewScope = true;
            } else if (/\w/.test(c)) {
                this.pendingNewScope = false;
            }

            if (this.isQuote(c) || this.beginSet.includes(c)) {
                this.stack.push(c);
            }

            // are we back in a parent scope?
            while (this.stack.length > 0 && this.currentScope <= Number(this.top())) {
                const lastScope = this.stack.pop()!;
                if (this.scopeNameStack.has(lastScope)) {
                    this.scopeNameStack.delete(lastScope);
                }

                if (this.stack.length === this.functionStart) {
                    this.resetFunction();
                    this.resetFunctionCallback();
                }
            }
        }
    }
}
