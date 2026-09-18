"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { toBcp47 } from "@/i18n/routing";
import { CATEGORY_BADGE_CLASS } from "@/lib/category-badge";
import type { SerializedPost } from "./types";

export function PostCard({ post }: { post: SerializedPost }) {
  const t = useTranslations("blog");
  const locale = useLocale();
  // Locked posts must hard-navigate (plain <a>) — Next's <Link> soft
  // navigation fetches a plaintext RSC payload that bypasses the password
  // gate entirely (the gate only lives in the server-rendered index.html).
  const LinkOrAnchor = post.locked ? "a" : Link;
  return (
    <LinkOrAnchor href={post.href} className="group block">
      <Card className="h-full transition-colors hover:border-primary/40">
        {post.image && (
          <div className="overflow-hidden rounded-t-lg">
            <img
              src={post.image}
              alt=""
              className="h-40 w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <CardHeader className="pb-2">
          {post.categories?.[0] && (
            <Badge variant="outline" className={`mb-1 w-fit text-[10px] ${CATEGORY_BADGE_CLASS}`}>
              {post.categories[0]}
            </Badge>
          )}
          <CardTitle className="text-base font-heading leading-snug transition-colors group-hover:text-primary">
            {post.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          {post.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {post.description}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {post.date && (
            <time>
              {formatDate(
                post.date,
                { month: "short", day: "numeric", year: "numeric" },
                toBcp47(locale),
              )}
            </time>
          )}
          <span>&middot;</span>
          <span>{t("minRead", { minutes: post.readingTime })}</span>
          {post.tags && post.tags.length > 0 && (
            <>
              <span>&middot;</span>
              <div className="flex flex-wrap gap-1">
                {post.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardFooter>
      </Card>
    </LinkOrAnchor>
  );
}
