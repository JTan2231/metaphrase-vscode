import axios from "axios";
import { Embedding } from "./embedding";

const apiKey = "";

export async function getEmbedding(text: string): Promise<Embedding> {
    const apiUrl = "https://api.openai.com/v1/embeddings";

    const response = await axios.post(
        apiUrl,
        {
            model: "text-embedding-ada-002",
            input: text
        },
        {
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "Content-Type": "application/json",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                Authorization: `Bearer ${apiKey}`
            }
        }
    );

    const embeddingData = response.data.data[0].embedding;
    let embedding = new Embedding(embeddingData);
    embedding.normalize();

    return embedding;
}
