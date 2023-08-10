import axios from "axios";
import { Embedding } from "./embedding";

const apiKey = "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";

export async function getEmbedding(
    text: string
): Promise<[boolean, Embedding]> {
    const apiUrl = "https://api.openai.com/v1/embeddings";

    try {
        const response = await axios.post(
            apiUrl,
            {
                model: "text-embedding-ada-002",
                input: text,
            },
            {
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    "Content-Type": "application/json",
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    Authorization: `Bearer ${apiKey}`,
                },
            }
        );
        const embeddingData = response.data.data[0].embedding;
        let embedding = new Embedding(embeddingData);
        embedding.normalize();

        return [true, embedding];
    } catch (e) {
        console.log(e);
        return [false, new Embedding([] as number[])];
    }
}

export async function getEmbeddingsBatch(
    keyValues: [string, string][]
): Promise<[number, Embedding[]]> {
    const apiUrl = "https://api.openai.com/v1/embeddings";

    try {
        const keys = keyValues.map((x) => x[0]);
        const values = keyValues.map((x) => "text:" + x[1]);

        const response = await axios.post(
            apiUrl,
            {
                model: "text-embedding-ada-002",
                input: values,
            },
            {
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    "Content-Type": "application/json",
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    Authorization: `Bearer ${apiKey}`,
                },
            }
        );

        console.log(
            `contacted ${apiUrl} with status ${response.status}: ${response.statusText}`
        );

        const embeddings = response.data.data.map((embed: any) => {
            const e = new Embedding(embed.embedding);
            e.normalize();
            return e;
        });

        return [response.data.usage.total_tokens, embeddings];
    } catch (e) {
        console.log(e);
        return [0, [new Embedding([] as number[])]];
    }
}
