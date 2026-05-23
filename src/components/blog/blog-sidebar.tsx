"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SITE_AUTHOR } from "@/lib/profile";
import { formatDate } from "@/lib/utils";

interface BlogSidebarProps {
  recentPosts: { title: string; date?: string; href: string }[];
  allTags: string[];
  activeTag?: string;
  onTagClick?: (tag: string) => void;
}

export function BlogSidebar({
  recentPosts,
  allTags,
  activeTag,
  onTagClick,
}: BlogSidebarProps) {
  const tSidebar = useTranslations("sidebar");
  const tBlog = useTranslations("blog");
  const locale = useLocale();
  return (
    <div className="space-y-4">
      {/* ── Mini About ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <Avatar className="h-16 w-16">
            <AvatarImage src={SITE_AUTHOR.avatar} alt={SITE_AUTHOR.name} />
            <AvatarFallback>0x</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{SITE_AUTHOR.name}</p>
            <p className="text-xs text-muted-foreground">{SITE_AUTHOR.bio}</p>
          </div>
          <Link
            href={`/${locale}${SITE_AUTHOR.href}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            {tSidebar("readMore")} &rarr;
          </Link>
        </CardContent>
      </Card>

      {/* ── Recent Posts ───────────────────────────────────────── */}
      {recentPosts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {tBlog("recentPosts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Separator />
            {recentPosts.map((post) => (
              <Link
                key={post.href}
                href={post.href}
                className="group block"
              >
                <p className="text-sm font-medium leading-snug transition-colors group-hover:text-primary">
                  {post.title}
                </p>
                {post.date && (
                  <time className="text-[11px] text-muted-foreground">
                    {formatDate(post.date, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Topics Cloud ───────────────────────────────────────── */}
      {allTags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{tSidebar("topics")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Separator className="mb-3" />
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const isActive = activeTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onTagClick?.(tag)}
                  >
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={`text-[11px] cursor-pointer transition-all ${
                        isActive
                          ? ""
                          : "hover:bg-primary/20 hover:text-primary hover:border-primary/40"
                      }`}
                    >
                      {tag}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
