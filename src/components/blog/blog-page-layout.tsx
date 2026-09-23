"use client";

import { useState } from "react";
import { BlogSearchLayout } from "./blog-search-layout";
import { BlogSidebar } from "./blog-sidebar";
import type { SerializedPost } from "./types";

interface BlogPageLayoutProps {
  featuredPost: SerializedPost | null;
  posts: SerializedPost[];
  recentPosts: { title: string; date?: string; href: string }[];
  allTags: string[];
}

export function BlogPageLayout({
  featuredPost,
  posts,
  recentPosts,
  allTags,
}: BlogPageLayoutProps) {
  const [tagFilter, setTagFilter] = useState("");

  const handleTagClick = (tag: string) => {
    setTagFilter((prev) => (prev === tag ? "" : tag));
  };

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Main Column */}
      <main className="w-full min-w-0 lg:w-[70%]">
        <BlogSearchLayout
          featuredPost={featuredPost}
          posts={posts}
          externalQuery={tagFilter}
        />
      </main>

      {/* Right Sidebar */}
      <aside className="w-full lg:w-[30%]">
        <div className="lg:sticky lg:top-20">
          <BlogSidebar
            recentPosts={recentPosts}
            allTags={allTags}
            activeTag={tagFilter}
            onTagClick={handleTagClick}
          />
        </div>
      </aside>
    </div>
  );
}
