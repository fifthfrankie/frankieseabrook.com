# frankieseabrook.com

A minimalist personal blog built with Astro and Bun.

## Features

- Typography-first design with excellent readability
- Zero JavaScript by default
- Syntax highlighting for code blocks
- RSS feed
- SEO and Open Graph support
- Mobile-responsive

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Tech Stack

- **Framework:** [Astro](https://astro.build)
- **Runtime:** [Bun](https://bun.sh)
- **Content:** Markdown with Content Collections
- **Styling:** Plain CSS with custom properties
- **Syntax Highlighting:** Shiki

## Project Structure

```
├── src/
│   ├── content/
│   │   └── posts/          # Blog posts (Markdown)
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro     # Homepage
│   │   ├── about.astro     # About page
│   │   ├── rss.xml.ts      # RSS feed
│   │   └── posts/
│   │       └── [...slug].astro
│   └── content.config.ts   # Content schema
└── public/
    └── favicon.svg
```

## License

MIT
