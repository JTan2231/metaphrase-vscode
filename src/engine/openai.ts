import axios from 'axios';

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = '';
  const apiUrl = 'https://api.openai.com/v1/embeddings';

  const response = await axios.post(apiUrl, {
    model: 'text-embedding-ada-002',
    input: text,
  }, {
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  const embedding = response.data.embedding;
  return embedding;
}
