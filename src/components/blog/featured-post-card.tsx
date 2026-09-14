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
import type { SerializedPost } from "./types";

export function FeaturedPostCard({ post }: { post: SerializedPost }) {
  const t = useTranslations("blog");
  const locale = useLocale();
  // See PostCard: locked posts must hard-navigate, not soft-navigate via <Link>.
  const LinkOrAnchor = post.locked ? "a" : Link;
  return (
    <LinkOrAnchor href={post.href} className="group block">
      <Card className="overflow-hidden transition-colors hover:border-primary/40">
        {post.image && (
          <div className="overflow-hidden">
            <img
              src={post.image}
              alt=""
              className="h-56 w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="default" className="text-[10px]">
              {t("featured")}
            </Badge>
            {post.categories?.[0] &&
              post.categories[0].toLowerCase() !== "featured" && (
                <Badge variant="secondary" className="text-[10px]">
                  {post.categories[0]}
                </Badge>
              )}
          </div>
          <CardTitle className="text-2xl font-heading leading-tight transition-colors group-hover:text-primary">
            {post.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          {post.description && (
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {post.description}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {post.date && (
            <time>
              {formatDate(
                post.date,
                { month: "long", day: "numeric", year: "numeric" },
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
                {post.tags.map((tag) => (
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
