import { unified } from '@astrojs/markdown-remark';
import react from '@astrojs/react';
import { transformerMetaHighlight } from '@shikijs/transformers';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import { contentPipeline } from './scripts/content-integration';
import { rehypeCodeFrame, rehypeExternalLinks, rehypeTables } from './src/markdown/rehype-plugins';
import {
  remarkCallouts,
  remarkCompare,
  remarkEscapeHtml,
  remarkHeadingIds,
  remarkInterviewSections,
  remarkLessonLinks,
  remarkRemoteImages,
  remarkVizSlots,
} from './src/markdown/remark-plugins';

/**
 * GitHub Pages project site: https://18-vk.github.io/LearnYourself/
 * For a custom domain later, build with SITE_URL=https://your.domain and BASE_PATH=/ (no other change).
 */
const SITE_URL = process.env.SITE_URL ?? 'https://18-vk.github.io';
const BASE_PATH = process.env.BASE_PATH ?? '/LearnYourself/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [contentPipeline(), react()],
  vite: {
    plugins: [tailwindcss()],
    server: { watch: { ignored: ['**/bin/**', '**/obj/**', '**/.vs/**', '**/.tools/**', '**/.cache/**'] } },
  },
  markdown: {
    processor: unified({
      gfm: true,
      smartypants: false,
      remarkPlugins: [
        remarkBreaks,
        remarkVizSlots,
        remarkEscapeHtml,
        remarkRemoteImages,
        [remarkLessonLinks, { base: BASE_PATH }],
        remarkCallouts,
        remarkCompare,
        remarkInterviewSections,
        remarkHeadingIds,
      ],
      rehypePlugins: [rehypeCodeFrame, rehypeTables, rehypeExternalLinks],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      langAlias: { cmd: 'bat', xpath: 'xml', cs: 'csharp', 'c#': 'csharp', none: 'plaintext' },
      transformers: [transformerMetaHighlight()],
    },
  },
});
