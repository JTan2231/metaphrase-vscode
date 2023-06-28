# Metaphrase - AI Code Context Builder
Navigate and understand code with GPT in VSCode.

## Language Support
- C
- TypeScript
- Golang
- Python (in progress)

## Commands
- Build Context
  - Creates `metaphrase.json` in the target folder to store functions, definitions, and embeddings.
- Generate Embeddings
  - Populates `metaphrase.json` with embeddings using [OpenAI's Embedding API](https://platform.openai.com/docs/guides/embeddings).
- Query Repository
  - Takes user query, embeds, then searches the existing embeddings for the closest match.
  - e.g. "Where are the eigenvalues being calculated?"
- Show Functions
  - Display a list of catalogued functions
