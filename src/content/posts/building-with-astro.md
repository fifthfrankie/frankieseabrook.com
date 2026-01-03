---
title: "Why I Built This Blog with Astro"
description: "A look at why Astro is an excellent choice for content-focused websites, and how this blog was built."
date: 2024-03-20
tags: ["astro", "web development", "meta"]
---

When I decided to finally start this blog, I spent some time evaluating different static site generators. I landed on Astro, and after building this site, I'm convinced it was the right choice.

## The Case for Static Sites

Before diving into Astro specifically, let's talk about why I went with a static site at all.

For a blog, you really don't need:
- A database
- Server-side rendering on every request
- Complex state management
- Heavy JavaScript frameworks

What you *do* need:
- Fast page loads
- Good SEO
- Simple content management
- Easy deployment

Static site generators give you all of this. Your site is pre-built at deploy time, served from a CDN, and loads nearly instantly.

## Why Astro?

There are plenty of static site generators out there. Here's why Astro stood out:

### Zero JavaScript by Default

Most frameworks ship JavaScript whether you need it or not. Astro takes the opposite approach - it ships zero JavaScript by default. You only add it when you actually need interactivity.

For a blog like this one, that means pages are just HTML and CSS. The result? Blazing fast loads and perfect Lighthouse scores.

### Content Collections

Astro has first-class support for content:

```typescript
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { posts };
```

With this setup, I get:
- Type-safe frontmatter
- Automatic validation
- Easy querying of all posts
- Built-in markdown processing

### Great Developer Experience

The Astro component syntax is clean and intuitive:

```astro
---
// This is the "component script" - runs at build time
const posts = await getCollection('posts');
---

<!-- This is the "component template" -->
<ul>
  {posts.map(post => (
    <li>
      <a href={`/posts/${post.slug}`}>{post.data.title}</a>
    </li>
  ))}
</ul>

<style>
  /* Scoped styles - only apply to this component */
  ul {
    list-style: none;
    padding: 0;
  }
</style>
```

The frontmatter-style script block runs at build time, not in the browser. The template is just HTML with JSX-like expressions. Styles are scoped by default. It's refreshingly simple.

### Bring Your Own Framework

If you do need interactive components, Astro supports React, Vue, Svelte, and others through integrations. You can even mix frameworks on the same page.

For this blog, I don't need any client-side framework, but it's nice to know the option exists.

## The Build

Here's a simplified overview of how this site is structured:

```
src/
├── content/
│   └── posts/          # Markdown blog posts
├── layouts/
│   └── BaseLayout.astro
├── pages/
│   ├── index.astro     # Homepage
│   ├── about.astro
│   ├── rss.xml.ts      # RSS feed
│   └── posts/
│       └── [...slug].astro  # Dynamic post pages
└── content.config.ts   # Content collection schema
```

The entire site is about 300 lines of code, most of which is CSS. There's no build configuration to speak of - Astro's defaults are sensible.

## Performance Results

The end result speaks for itself:

- **Lighthouse Performance**: 100
- **First Contentful Paint**: ~0.5s
- **Total Blocking Time**: 0ms
- **JavaScript Shipped**: 0 bytes

You can't get much faster than this. And because it's all static, hosting is essentially free on any CDN.

## Trade-offs

Astro isn't perfect for everything:

- If you need heavy client-side interactivity, you'll need to add a framework
- The ecosystem is smaller than Next.js or Gatsby
- Some advanced use cases require workarounds

For a content-focused site like this blog, these trade-offs are easy to accept. If I were building a web application, I'd reach for different tools.

## Wrapping Up

Astro feels like it was designed specifically for content websites. It makes the simple things simple and gets out of your way. If you're building a blog, documentation site, or marketing page, give it a try.

The code for this site is available on [GitHub](https://github.com/frankieseabrook/frankieseabrook.com) if you want to see exactly how it's built.
