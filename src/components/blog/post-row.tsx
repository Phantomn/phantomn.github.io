"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Calendar, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toBcp47 } from "@/i18n/routing";
import type { SerializedPost } from "./types";

/*
 * 글 목록의 한 줄. bshastry.github.io 의 components/Writing.tsx 구조로 교체한 것이다(저자 허락, CREDITS.md).
 * 이전에는 카드 그리드(post-card / featured-post-card)를 썼는데, 목록 글자의 16.6%가 10~11px 배지였고
 * 항목 제목이 h2/h3 가 아니어서 제목 위계가 없었다. 이제 왼쪽에 모노 메타(날짜/읽는 시간), 오른쪽에 제목과 요약이 오고
 * 줄 사이를 테두리로 나눈다. 분류·태그 배지와 섬네일은 넣지 않는다(태그는 목록 위 필터에서 다룬다).
 */
export function PostRow({ post }: { post: SerializedPost }) {
  const locale = useLocale();
  // 암호가 걸린 글은 <Link> 의 소프트 내비게이션이 RSC 페이로드로 잠금을 건너뛰므로 일반 <a> 로 강제 이동한다.
  const LinkOrAnchor = post.locked ? "a" : Link;
  return (
    <LinkOrAnchor
      href={post.href}
      className="focus-ring group flex flex-col gap-2 border-b py-6 transition-colors hover:bg-card md:flex-row md:items-baseline md:gap-8"
    >
      <div className="flex shrink-0 items-center gap-4 font-mono text-label text-faint-foreground md:w-40 md:flex-col md:items-start md:gap-1.5">
        {post.date && (
          <span className="flex items-center gap-1.5" data-notranslate>
            <Calendar size={12} className="shrink-0" aria-hidden />
            {formatDate(post.date, { year: "numeric", month: "short", day: "numeric" }, toBcp47(locale))}
          </span>
        )}
        <span className="flex items-center gap-1.5" data-notranslate>
          <Clock size={12} className="shrink-0" aria-hidden />
          {post.readingTime} min
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="text-subheading font-semibold transition-colors group-hover:text-primary">
          {post.title}
        </h3>
        {post.description && (
          <p className="mt-2 line-clamp-2 text-body-sm text-muted-foreground">{post.description}</p>
        )}
      </div>
    </LinkOrAnchor>
  );
}
