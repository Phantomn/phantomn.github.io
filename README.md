# Ph4nt0m.tech

Personal cybersecurity portfolio and blog.
Built with **Next.js 15**, **shadcn/ui**, **Tailwind CSS v4**, and **MDX**.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router, static export) |
| Language | TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| Icons | Font Awesome (SVG, free solid + brands) |
| Content | Markdown + MDX (@next/mdx, remark-gfm, rehype-pretty-code) |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

---

## Project structure

```
.
├── .github/workflows/deploy.yml   # CI/CD
├── content/                       # Markdown content
│   ├── blog/                      # Blog posts
│   └── writeups/                  # CTF writeups (flat, with platform/category in frontmatter)
├── public/                        # Static assets (images, docs, favicons)
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── layout.tsx             # Root layout (header, footer, theme)
│   │   ├── page.tsx               # Homepage (hero + section cards)
│   │   ├── about/page.tsx         # About (hardcoded profile, skills, achievements, resume)
│   │   ├── blog/page.tsx          # Blog listing (search, pagination, sidebar)
│   │   ├── blog/[slug]/page.tsx   # Blog post (ToC, reading progress, lightbox)
│   │   ├── toolbox/page.tsx       # Toolbox (category sidebar + tool grid)
│   │   ├── writeups/page.tsx      # Writeups data grid (sortable, searchable)
│   │   └── writeups/[slug]/       # Individual writeup page
│   ├── components/
│   │   ├── blog/                  # Blog components (cards, sidebar, ToC, lightbox)
│   │   ├── toolbox/               # Toolbox layout component
│   │   ├── writeups/              # Writeups data grid component
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── site-header.tsx        # Sticky navigation header
│   │   ├── site-footer.tsx        # Footer with social links
│   │   ├── image-lightbox.tsx     # Generic image lightbox modal
│   │   ├── theme-provider.tsx     # Dark/light mode provider
│   │   └── theme-toggle.tsx       # Theme switch button
│   ├── data/
│   │   └── toolbox.ts             # Toolbox tools data (categories, tools, URLs)
│   ├── lib/
│   │   ├── content.ts             # Content loading (frontmatter parsing, writeup helpers)
│   │   ├── icons.ts               # Font Awesome icon registry
│   │   ├── profile.ts             # Shared author profile constant
│   │   └── utils.ts               # shadcn utility (cn)
│   ├── mdx-components.tsx         # MDX global components (headings with IDs)
│   └── styles/
│       └── globals.css            # Global styles (prose, syntax highlighting, tables)
├── components.json                # shadcn/ui config
├── next.config.ts                 # Static export + MDX plugins
├── tsconfig.json
├── package.json
└── CNAME
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage — hero with animated GIF, section cards |
| `/about/` | Profile, skills, achievements, certifications, resume |
| `/blog/` | Blog listing with search, pagination, topic sidebar |
| `/blog/[slug]/` | Blog post with reading progress, ToC, related posts, image lightbox |
| `/writeups/` | Sortable & searchable data grid of all CTF writeups |
| `/writeups/[slug]/` | Individual writeup page |
| `/toolbox/` | Curated cybersecurity tools organized by category with search |

---

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

---

## Build (static export)

```bash
npm run build
```

Output: `out/` directory with static HTML/CSS/JS ready for GitHub Pages.

---

## Deploy

Push to `main` or `master`. GitHub Actions will:
1. `npm ci`
2. `npm run build`
3. Upload `out/` to GitHub Pages

---

## Adding content

### Blog post

Drop a `.md` file in `content/blog/` with frontmatter:

```yaml
---
title: "My New Post"
date: 2024-03-15
tags: [cybersecurity, SOC]
categories: [SOC]
image: "https://picsum.photos/seed/mypost/1200/630"
---

Your content here...
```

### Writeup

Drop a `.md` file in `content/writeups/` with frontmatter:

```yaml
---
title: "Machine Name"
date: 2024-03-15
platform: "htb"
category: "redteam"
difficulty: "Easy"
tags: [HackTheBox, Linux, Web]
---

Your writeup here...
```

Supported platforms: `htb`, `thm`, `vulnhub`, `cyberdefenders`, `letsdefend`, `portswigger`.
Supported categories: `redteam`, `blueteam`, `web`.

---

## Color palette

### Dark mode (default)
| Role | Hex |
|------|-----|
| Primary (accent) | `#9FEF00` |
| Background | `#0d1117` |
| Surface | `#161b22` |
| Border | `#21262d` |
| Text | `#c9d1d9` |
| Headings | `#ffffff` |

### Light mode
| Role | Hex |
|------|-----|
| Primary | `#121212` |
| Background | `#ffffff` |
| Surface | `#f6f6f6` |
| Border | `#eaeaea` |
| Text | `#444444` |
