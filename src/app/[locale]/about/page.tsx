import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { DynamicTranslator } from "@/components/dynamic-translator";
import {
  CVE_ITEMS,
  CVE_ONLY_COUNT,
  FVE_COUNT,
  isAssignedCve,
  type CveEntry,
} from "@/data/cves";
import { describeEvents } from "@/data/competitions";
import { SITE_AUTHOR } from "@/lib/profile";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("title") };
}

const NAME = "홍승표 (ph4nt0m)";
const COMPANY = "CoreSecurity";

/** 그룹별 발견 경위. 데이터에 필드가 없어 여기서 붙인다. */
const GROUP_NOTE: Record<string, string> = {
  Kernel: "BoB 8기에서 직접 만든 커널 퍼저로 발견",
};

const RESUME_LINKS = [
  { label: "한국어", href: "/docs/resume-ko.pdf" },
  { label: "English", href: "/docs/resume-en.pdf" },
];

/** 한 연도의 CVE가 이 수를 넘으면 접어 둔다. */
const FOLD_OVER = 5;

/** 사이트 본문 링크 규칙(globals.css .prose a)을 그대로 쓴다. */
const LINK = "prose-link";
const H2 = "mb-3.5 font-heading text-2xl font-semibold tracking-tight";
const H3 = "mb-1.5 text-base font-bold tabular-nums";
const LIST = "list-disc space-y-1.5 pl-5";

/** 정식 번호가 부여된 CVE를 연도별로 묶고, 번호 대기는 같은 연도에 표시하고, FVE는 연도별 건수만 센다. 최신 연도 먼저. */
function groupByYear() {
  const years = new Map<number, { cves: CveEntry[]; pending: CveEntry[]; fve: number }>();
  for (const item of CVE_ITEMS) {
    let slot = years.get(item.year);
    if (!slot) {
      slot = { cves: [], pending: [], fve: 0 };
      years.set(item.year, slot);
    }
    if (item.kind === "fve") slot.fve += 1;
    else if (isAssignedCve(item)) slot.cves.push(item);
    else slot.pending.push(item);
  }
  return [...years.entries()].sort((a, b) => b[0] - a[0]);
}

function CveLine({
  item,
  locale,
  label,
}: {
  item: CveEntry;
  locale: string;
  label: string;
}) {
  return (
    <li>
      <Link href={`/${locale}/cves/${item.slug}/`} className={LINK}>
        {label}
      </Link>{" "}
      {item.title}{" "}
      <span className="text-[0.92em] text-muted-foreground">
        CVSS {item.score.toFixed(1)}
      </span>
    </li>
  );
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });
  const shouldTranslate = locale !== routing.defaultLocale;
  const years = groupByYear();

  return (
    <DynamicTranslator
      enabled={shouldTranslate}
      targetLocale={locale}
      contentKey="about"
    >
      <article className="mx-auto w-[90vw] max-w-[52rem] break-keep py-10 text-[1.0625rem] leading-[1.85]">
        <header>
          <h1 className="font-heading text-[2.5rem] leading-[1.15] font-bold tracking-tight">
            {NAME}
          </h1>
          <p className="mt-2 text-[0.95rem] text-muted-foreground">{COMPANY}</p>
        </header>
        {/* 메시지로 이미 번역된 문장이라 런타임 번역기가 다시 건드리지 않게 한다 */}
        <p className="mt-6 max-w-[40rem]" data-notranslate>
          {t("intro")}
        </p>

        <section className="mt-9 border-t pt-8">
          <h2 className={H2}>{t("sectionCompetitions")}</h2>
          <ul className={LIST}>
            {describeEvents().map((e) => (
              <li key={e.name}>
                <b className="font-semibold">{e.name}</b> {e.editions.join(" / ")}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-9 border-t pt-8">
          <h2 className={H2}>{t("sectionVulns")}</h2>
          <p className="-mt-1.5 mb-1 text-[0.95em] text-muted-foreground">
            {t("vulnCounts", { cve: CVE_ONLY_COUNT, fve: FVE_COUNT })}
          </p>
          {years.map(([year, { cves, pending, fve }]) => {
            const fold = cves.length > FOLD_OVER;
            const pendingLines = pending.map((item) => (
              <li key={item.id}>
                <Link href={`/${locale}/cves/${item.slug}/`} className={LINK}>
                  {item.title}
                </Link>{" "}
                <span className="text-[0.92em] text-muted-foreground">
                  CVSS {item.score.toFixed(1)} · {t("pendingLabel")}
                </span>
              </li>
            ));
            const fveLine = fve > 0 && (
              <li>
                <b className="font-semibold">{t("fveLine", { n: fve })}</b>
              </li>
            );
            return (
              <div key={year} className="mt-5 first-of-type:mt-2">
                <h3 className={H3}>{year}</h3>
                {fold ? (
                  <>
                    <details className="my-1">
                      <summary className="cursor-pointer py-0.5 marker:text-primary">
                        <b className="font-semibold">
                          {t("groupCount", {
                            group: cves[0].groupLabel,
                            n: cves.length,
                          })}
                        </b>{" "}
                        <span className="text-[0.92em] text-muted-foreground">
                          {t("maxCvss", {
                            score: Math.max(...cves.map((c) => c.score)).toFixed(1),
                          })}
                          {GROUP_NOTE[cves[0].groupKey]
                            ? `. ${GROUP_NOTE[cves[0].groupKey]}`
                            : ""}
                        </span>
                      </summary>
                      <ul className={`${LIST} mt-1.5`}>
                        {cves.map((item) => (
                          <CveLine
                            key={item.id}
                            item={item}
                            locale={locale}
                            label={item.id}
                          />
                        ))}
                      </ul>
                    </details>
                    {(pendingLines.length > 0 || fveLine) && (
                      <ul className={LIST}>
                        {pendingLines}
                        {fveLine}
                      </ul>
                    )}
                  </>
                ) : (
                  <ul className={LIST}>
                    {cves.map((item) => (
                      <CveLine
                        key={item.id}
                        item={item}
                        locale={locale}
                        label={item.id}
                      />
                    ))}
                    {pendingLines}
                    {fveLine}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-9 border-t pt-8">
          <h2 className={H2}>{t("sectionCareer")}</h2>
          <p>
            {t.rich("career", {
              link: (chunks) => (
                <Link href={`/${locale}/portfolio/`} className={LINK}>
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </section>

        <section className="mt-9 border-t pt-8">
          <h2 className={H2}>{t("sectionContact")}</h2>
          <dl className="space-y-1">
            <div className="flex gap-4">
              <dt className="w-[4.5rem] shrink-0 text-muted-foreground">
                {t("labelEmail")}
              </dt>
              <dd>
                <a href={`mailto:${SITE_AUTHOR.email}`} className={LINK}>
                  {SITE_AUTHOR.email}
                </a>
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-[4.5rem] shrink-0 text-muted-foreground">
                {t("labelResume")}
              </dt>
              <dd>
                {RESUME_LINKS.map((r, i) => (
                  <span key={r.href}>
                    {i > 0 && ", "}
                    <a href={r.href} download className={LINK}>
                      {r.label}
                    </a>
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </section>
      </article>
    </DynamicTranslator>
  );
}
