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
import { formatDate } from "@/lib/utils";
import { normalizeTag } from "@/lib/taxonomy";
import { TableOfContents } from "./table-of-contents";
import type { SerializedPost } from "./types";

interface PostSidebarProps {
  relatedPosts: SerializedPost[];
  relatedTags: string[];
}

export function PostSidebar({ relatedPosts, relatedTags }: PostSidebarProps) {
  const t = useTranslations("sidebar");
  const locale = useLocale();
  return (
    <div className="space-y-4">
      {/* ── Table of Contents ──────────────────────────────────── */}
      <TableOfContents />

      {/* ── Related Posts ──────────────────────────────────────── */}
      {relatedPosts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t("relatedPosts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Separator />
            {relatedPosts.map((post) => (
              <Link
                key={post.href}
                href={post.href}
                className="group flex gap-3"
              >
                {post.image && (
                  <img
                    src={post.image}
                    alt=""
                    className="h-12 w-16 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug transition-colors group-hover:text-primary line-clamp-2">
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
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Related Topics ─────────────────────────────────────── */}
      {relatedTags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t("relatedTopics")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Separator className="mb-3" />
            <div className="flex flex-wrap gap-2">
              {relatedTags.map((tag) => (
                <Link key={tag} href={`/${locale}/tags/${normalizeTag(tag)}/`}>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer text-[11px] transition-all hover:bg-primary/20 hover:text-primary"
                  >
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
