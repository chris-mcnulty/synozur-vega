-- SEO Config table for managing landing page SEO metadata
CREATE TABLE IF NOT EXISTS "seo_config" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL DEFAULT 'Vega - The Synozur Alliance Company OS',
  "description" TEXT NOT NULL DEFAULT 'Vega delivers the ultimate Company Operating System experience with AI-powered foundations, strategy, planning, and focus rhythm modules for modern organizations. Designed by former Microsoft Viva product leadership.',
  "og_description" TEXT NOT NULL DEFAULT 'Vega delivers the ultimate Company Operating System experience. Designed by former Microsoft Viva product leadership.',
  "keywords" TEXT NOT NULL DEFAULT 'company operating system, OKR software, strategy execution, AI-powered OKRs, business alignment, leadership cadence, Synozur, Vega',
  "canonical_url" TEXT NOT NULL DEFAULT 'https://vega.synozur.com',
  "updated_by" VARCHAR,
  "updated_at" TIMESTAMP DEFAULT NOW()
);
