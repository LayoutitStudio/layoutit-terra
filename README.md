# Layoutit Terra

Layoutit Terra is a Nuxt 2 static app for building and exporting low-poly CSS terrain scenes.

## Development

Install dependencies:

```sh
npm install
```

Run the local development server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

Generate the static site:

```sh
npm run generate
```

Gallery saves use Supabase when these build-time environment variables are set:

```sh
NUXT_ENV_SUPABASE_URL=
NUXT_ENV_SUPABASE_ANON_KEY=
```

The generated Nuxt and static output folders, including `.nuxt/` and `dist/`, are intentionally ignored. Source assets that the app serves directly belong in `static/`.

## Repository Layout

- `components/`: Vue components for the editor UI and terrain pieces.
- `layouts/`: Nuxt page layout.
- `pages/`: Nuxt routes, including `/` and `/embed`.
- `plugins/`: Nuxt plugins.
- `static/`: source static assets served by Nuxt.
- `utils/`: terrain, camera, lighting, and export helpers.
