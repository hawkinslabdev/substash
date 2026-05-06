# Contributing

Thanks for considering contributing to Substash.

To set up a development environment, run the following:

```bash
cp .env.example .env        # fill in STASH_URL and STASH_API_KEY
npm install
npm run db:migrate          # creates the local SQLite database
npm run dev                 # starts the dev server at http://localhost:9456
```

Optionally, regenerate TypeScript types from your live Stash instance:

```bash
npm run codegen
```
