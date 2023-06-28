export class Embedding {
    data: Array<number>;

    constructor(data: number[]) {
        this.data = new Array<number>(1536);

        if (data.length === 0) {
            return;
        }

        if (data.length !== 1536) {
            console.log("error: embedding dimensions must be 1536");
            throw EvalError;
        }

        for (let i = 0; i < data.length; i++) {
            this.data[i] = data[i];
        }
    }

    normalize() {
        let magnitude = 0;

        for (const n of this.data) {
            magnitude += n * n;
        }

        magnitude = Math.sqrt(magnitude);
        for (let i = 0; i < this.data.length; i++) {
            this.data[i] /= magnitude;
        }
    }
}

export function dot(e1: Embedding, e2: Embedding): number {
    let output = 0;
    for (let i = 0; i < e1.data.length; i++) {
        output += e1.data[i] * e2.data[i];
    }

    return output;
}
