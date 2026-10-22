/**
 * Interview Prep's gallery: the approved images and PDFs whose `usedBy` (curriculum/_assets.yaml) starts with
 * "interview-prep/". Processed files and metadata come from src/data/generated/assets.json.
 */
import assetsRaw from '../data/generated/assets.json';

export interface GalleryAsset {
  file: string;
  slug: string;
  title: string;
  kind: 'image' | 'pdf' | 'document';
  authorship: string;
  credit: string | null;
  alt: string | null;
  usedBy: string | null;
  src?: string;
  srcset?: string;
  width?: number;
  height?: number;
}

/** "InterviewQues1" → "Interview Ques 1", "100InterviewQuestion" → "100 Interview Question" */
export const humanize = (s: string): string =>
  s
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

export function galleryAssets(): { images: GalleryAsset[]; pdfs: GalleryAsset[] } {
  const list = (assetsRaw as unknown as GalleryAsset[]).filter((a) => a.usedBy?.startsWith('interview-prep/') && a.src);
  return { images: list.filter((a) => a.kind === 'image'), pdfs: list.filter((a) => a.kind === 'pdf') };
}
