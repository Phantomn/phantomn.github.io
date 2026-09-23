"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useUrlState } from "@/hooks/use-url-state";
import { Input } from "@/components/ui/input";
import { PostRow } from "./post-row";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import type { SerializedPost } from "./types";

const POSTS_PER_PAGE = 6;

interface BlogSearchLayoutProps {
  featuredPost: SerializedPost | null;
  posts: SerializedPost[];
  externalQuery?: string;
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);
  return pages;
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={currentPage > 1 ? `?page=${currentPage - 1}` : "#"}
            onClick={(e) => {
              e.preventDefault();
              if (currentPage > 1) onPageChange(currentPage - 1);
            }}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            aria-disabled={currentPage <= 1}
          />
        </PaginationItem>

        {pages.map((page, idx) =>
          page === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${idx}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                href={`?page=${page}`}
                isActive={page === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(page);
                }}
                className="cursor-pointer"
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            href={currentPage < totalPages ? `?page=${currentPage + 1}` : "#"}
            onClick={(e) => {
              e.preventDefault();
              if (currentPage < totalPages) onPageChange(currentPage + 1);
            }}
            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            aria-disabled={currentPage >= totalPages}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export function BlogSearchLayout(props: BlogSearchLayoutProps) {
  return (
    <Suspense>
      <BlogSearchLayoutInner {...props} />
    </Suspense>
  );
}

function BlogSearchLayoutInner({
  featuredPost,
  posts,
  externalQuery = "",
}: BlogSearchLayoutProps) {
  const t = useTranslations("blog");
  const [query, setQuery] = useState("");
  const [pageParam, setPageParam] = useUrlState("page", "1");
  const currentPage = Number(pageParam) || 1;
  const setCurrentPage = (page: number) => setPageParam(String(page));

  const activeQuery = externalQuery || query;
  const allPosts = featuredPost ? [featuredPost, ...posts] : posts;

  const isTagFilter = !!externalQuery && !query;

  const filtered = activeQuery.trim()
    ? allPosts.filter((p) => {
        const q = activeQuery.toLowerCase();
        if (isTagFilter) {
          // Exact match on tags/categories only
          return (
            p.tags?.some((t) => t.toLowerCase() === q) ||
            p.categories?.some((c) => c.toLowerCase() === q)
          );
        }
        // Text search: partial match across all fields
        return (
          p.title.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q)) ||
          p.categories?.some((c) => c.toLowerCase().includes(q))
        );
      })
    : [];

  const isSearching = activeQuery.trim().length > 0;

  // Reset to page 1 when search query changes (not on initial mount, so a
  // deep-linked ?page=N survives hydration instead of being wiped)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setCurrentPage(1);
  }, [query, externalQuery]);

  // Clear text search when external tag filter is active
  useEffect(() => {
    if (externalQuery) setQuery("");
  }, [externalQuery]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (isSearching) {
    const totalSearchPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
    const paginatedResults = filtered.slice(
      (currentPage - 1) * POSTS_PER_PAGE,
      currentPage * POSTS_PER_PAGE
    );

    return (
      <div className="space-y-6">
        {/* Search */}
        <div className="relative">
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-4 text-body-sm"
          />
        </div>

        <p className="text-meta text-muted-foreground">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} for
          &ldquo;{query}&rdquo;
        </p>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            {t("noResults")}
          </p>
        ) : (
          <>
            <div className="border-t">
              {paginatedResults.map((post) => (
                <PostRow key={post.slug} post={post} />
              ))}
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalSearchPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    );
  }

  // 기본 목록. 대표 글도 그냥 최신 글이므로 한 목록에 함께 넣는다(예전에는 위에 카드로 따로 뽑았다).
  const totalDefaultPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = allPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Input
          type="search"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 pl-4 text-body-sm"
        />
      </div>

      {paginatedPosts.length > 0 && (
        <div className="border-t">
          {paginatedPosts.map((post) => (
            <PostRow key={post.slug} post={post} />
          ))}
        </div>
      )}

      {allPosts.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {t("noPosts")}
        </p>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalDefaultPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
