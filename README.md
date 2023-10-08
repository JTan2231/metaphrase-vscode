# Metaphrase - AI Code Search

Navigate and understand code with GPT in VSCode. Metaphrase breaks down programs into a list a functions, then creates embeddings for each of those functions with [OpenAI's Embedding API](https://platform.openai.com/docs/guides/embeddings).

## TODO
- LLVM / pre-existing parsing tools?
- More LLM integration? e.g. "How is `process` being done?"

## Language Support

-   C
-   C++ (largely unverified)
-   TypeScript
-   Python

## Commands

-   Build Context
    -   Creates `metaphrase.json` in the target folder to store functions, and defintions.
-   Generate Embeddings
    -   Retrieves the embeddings from OpenAI's API using the parsed functions.
-   Query Repository
    -   Takes user query, embeds, then searches the existing embeddings for the closest match.
    -   e.g. "Where are the eigenvalues being calculated?"
-   Show Functions
    -   Display a list of catalogued functions

## Potential TODO

-   Cleanup for publishing
-   More GPT code integration? (e.g. explanation, generation, etc.)
-   Other languages
-   Update changed function embeddings (instead of all or nothing)
-   Better VSCode GUI usage
-   Options in query results
