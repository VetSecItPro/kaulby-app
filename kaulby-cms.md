# Kaulby CMS Strategy - Payload CMS

## Decision Summary

**Chosen Solution:** Payload CMS (self-hosted on Hostinger VPS)

**Why not Sanity:**
- Sanity Content Lake is cloud-only (cannot self-host the database)
- You can host Sanity Studio anywhere, but content always lives on their servers
- Ongoing costs as you scale ($15-99/mo per project)

**Why Payload CMS:**
- Fully self-hostable (database, admin, API - all on your VPS)
- Zero cloud dependencies, zero monthly fees
- Built for Next.js specifically
- Modern TypeScript-first architecture
- Multi-tenant capable (one instance for all projects)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  PAYLOAD CMS (Hostinger VPS)                    │
│                     cms.yourdomain.com                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  MongoDB Database                                          │ │
│  │  ├── Articles (with project field for filtering)          │ │
│  │  ├── Categories                                            │ │
│  │  ├── Authors                                               │ │
│  │  └── Media                                                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│                            │                                    │
│                       REST/GraphQL API                          │
└────────────────────────────┼────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   KAULBY     │    │    ROWAN     │    │ STILLMOTION  │
│   (Vercel)   │    │   (Vercel)   │    │              │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ Dark theme   │    │ Light theme  │    │ Cinematic    │
│ Teal accents │    │ Blue accents │    │ style        │
│ /articles/*  │    │ /articles/*  │    │ /blog/*      │
└──────────────┘    └──────────────┘    └──────────────┘

Each site fetches from Payload API and renders with its own design
```

---

## Projects to Support

| Project | Domain | Article Path | Status |
|---------|--------|--------------|--------|
| Still Motion LLC | stillmotionlc.com | /blog/* | Existing (migrate 4 articles from Sanity) |
| Kaulby | kaulbyapp.com | /articles/* | New |
| Rowan | rowan-app.com | /articles/* | New |
| Future SaaS #4 | TBD | /articles/* | 2026 |
| Future SaaS #5 | TBD | /articles/* | 2026 |

---

## Resource Requirements

### Payload CMS Stack
| Component | RAM Usage | CPU | Notes |
|-----------|-----------|-----|-------|
| Payload (Node.js) | 200-400 MB | Minimal | Main application |
| MongoDB | 300-500 MB | Minimal | Can tune lower |
| Nginx/Caddy | ~50 MB | Minimal | Reverse proxy + SSL |
| **Total** | ~500-800 MB | Light | <10% of KVM2 |

### Hostinger KVM2 Specs
- 2 vCPU
- 8GB RAM
- 100GB NVMe SSD
- **Verdict:** More than sufficient

---

## Docker Deployment

### docker-compose.yml
```yaml
version: '3.8'

services:
  payload:
    build: .
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URI=mongodb://mongo:27017/payload
      - PAYLOAD_SECRET=${PAYLOAD_SECRET}
      - PAYLOAD_PUBLIC_SERVER_URL=https://cms.yourdomain.com
    depends_on:
      - mongo
    restart: unless-stopped
    volumes:
      - payload_uploads:/app/uploads

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
  payload_uploads:
```

### Caddy (Reverse Proxy + Auto SSL)
```
cms.yourdomain.com {
    reverse_proxy payload:3001
}
```

---

## Payload Schema Design

### Article Collection
```typescript
// collections/Articles.ts
import { CollectionConfig } from 'payload/types';

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'project', 'status', 'publishedAt'],
  },
  access: {
    read: () => true, // Public read for API
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'project',
      type: 'select',
      required: true,
      options: [
        { label: 'Kaulby', value: 'kaulby' },
        { label: 'Rowan', value: 'rowan' },
        { label: 'Still Motion', value: 'stillmotion' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'excerpt',
      type: 'textarea',
      maxLength: 300,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'authors',
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
    },
    // SEO Fields
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea', maxLength: 160 },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
        { name: 'canonicalUrl', type: 'text' },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
};
```

### Category Collection
```typescript
// collections/Categories.ts
export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    {
      name: 'project',
      type: 'select',
      options: [
        { label: 'Kaulby', value: 'kaulby' },
        { label: 'Rowan', value: 'rowan' },
        { label: 'Still Motion', value: 'stillmotion' },
      ],
    },
  ],
};
```

### Author Collection
```typescript
// collections/Authors.ts
export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'bio', type: 'textarea' },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    { name: 'twitter', type: 'text' },
    { name: 'linkedin', type: 'text' },
  ],
};
```

---

## Fetching Articles in Next.js (Kaulby Example)

### API Route or Direct Fetch
```typescript
// lib/payload.ts
const PAYLOAD_API = process.env.PAYLOAD_API_URL || 'https://cms.yourdomain.com/api';

export async function getArticles(project: string = 'kaulby') {
  const res = await fetch(
    `${PAYLOAD_API}/articles?where[project][equals]=${project}&where[status][equals]=published&sort=-publishedAt`,
    { next: { revalidate: 60 } } // ISR: revalidate every 60 seconds
  );
  const data = await res.json();
  return data.docs;
}

export async function getArticleBySlug(slug: string) {
  const res = await fetch(
    `${PAYLOAD_API}/articles?where[slug][equals]=${slug}&where[status][equals]=published`,
    { next: { revalidate: 60 } }
  );
  const data = await res.json();
  return data.docs[0] || null;
}
```

### Article List Page
```typescript
// app/articles/page.tsx
import { getArticles } from '@/lib/payload';

export default async function ArticlesPage() {
  const articles = await getArticles('kaulby');

  return (
    <div>
      <h1>Articles</h1>
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
```

### Individual Article Page
```typescript
// app/articles/[slug]/page.tsx
import { getArticleBySlug, getArticles } from '@/lib/payload';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const articles = await getArticles('kaulby');
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }) {
  const article = await getArticleBySlug(params.slug);
  if (!article) return {};

  return {
    title: article.seo?.metaTitle || article.title,
    description: article.seo?.metaDescription || article.excerpt,
    openGraph: {
      images: [article.seo?.ogImage?.url || article.coverImage?.url],
    },
  };
}

export default async function ArticlePage({ params }) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  return (
    <article>
      {/* Render with Kaulby's design */}
    </article>
  );
}
```

---

## Migration Plan

### From Sanity (Still Motion - 4 articles)
1. Export content from Sanity (or copy/paste - only 4 articles)
2. Create articles in Payload with `project: 'stillmotion'`
3. Update Still Motion site to fetch from Payload instead of Sanity
4. Verify articles render correctly
5. Delete Sanity project (optional)

### Timeline
| Step | Task | Effort |
|------|------|--------|
| 1 | Set up Payload on VPS | 1-2 hours |
| 2 | Configure schemas | 30 min |
| 3 | Migrate Still Motion articles | 30 min |
| 4 | Build Kaulby /articles pages | 1-2 hours |
| 5 | Build Rowan /articles pages | 1-2 hours |
| 6 | DNS + SSL setup | 30 min |

---

## Maintenance Tasks

| Task | Frequency | Command/Action |
|------|-----------|----------------|
| Update Payload | Monthly | `docker-compose pull && docker-compose up -d` |
| Database backup | Daily (cron) | `mongodump` to backup location |
| SSL renewal | Auto | Caddy handles automatically |
| Monitor logs | As needed | `docker-compose logs -f` |

---

## Security Considerations

1. **Admin Access**: Payload has built-in auth with roles
2. **API Access**: Configure CORS to only allow your domains
3. **Rate Limiting**: Add via Caddy or Nginx
4. **Backups**: Automated daily backups of MongoDB
5. **Updates**: Keep Payload and dependencies updated

---

## Cost Comparison

| Solution | Year 1 | Year 2+ | Notes |
|----------|--------|---------|-------|
| Sanity (5 projects) | $0-500 | $500-1500 | Scales with usage |
| Payload (self-hosted) | $0 | $0 | VPS already owned |

---

## Next Steps

1. [ ] Set up Payload CMS on Hostinger VPS
2. [ ] Configure multi-project schema
3. [ ] Migrate Still Motion articles from Sanity
4. [ ] Build /articles pages for Kaulby
5. [ ] Build /articles pages for Rowan
6. [ ] Add "Articles" nav link to all sites
7. [ ] Write initial SEO articles for each project

---

## Payload CMS Resources

- Documentation: https://payloadcms.com/docs
- GitHub: https://github.com/payloadcms/payload
- Discord: https://discord.com/invite/payload
- Examples: https://github.com/payloadcms/payload/tree/main/examples
