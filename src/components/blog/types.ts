export interface SerializedPost {
  slug: string;
  title: string;
  description?: string;
  date?: string;
  tags?: string[];
  categories?: string[];
  image?: string;
  readingTime: number;
  href: string;
  /** Password-gated post: card must use a plain <a> so navigation always hard-loads the encrypted page (see scripts/lock-posts.mjs). */
  locked?: boolean;
}
