import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

const HERO_VIDEO =
  "https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/video/upload/q_auto/f_auto/v1776380472/Website/Homepage/912938669731443170483_b9tluh.mp4";
const HERO_AVATAR =
  "https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776380450/Website/Homepage/54879845732140987541253743874983361_hfxt3v.gif";

const SECTION_KEYS = ["blog", "cves", "writeups", "toolbox"] as const;

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <div>
      <section className="relative min-h-[calc(100dvh-3.5rem)] flex flex-col items-center justify-center overflow-hidden px-4">
        <video
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO}
        />
        <div className="absolute inset-0 bg-background/60 dark:bg-background/70" aria-hidden />
        <div className="relative z-10 mx-auto max-w-2xl text-center flex flex-col items-center">
          <img
            src={HERO_AVATAR}
            alt="0xrh0d4m1n"
            className="mb-6 h-56 w-56 sm:h-72 sm:w-72 aspect-square rounded-full object-cover border-4 border-primary shadow-[0_0_40px_rgba(159,239,0,0.3)]"
          />

          <h1 className="mb-4 text-4xl font-bold font-heading sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto text-lg text-muted-foreground">
            {t("description")}
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href={`/${locale}/blog/`}>{t("goToBlog")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SECTION_KEYS.map((key) => (
          <Link key={key} href={`/${locale}/${key}/`} className="group block">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent">
              <CardHeader>
                <CardTitle className="font-heading text-xl text-card-foreground group-hover:text-primary">
                  {t(`sections.${key}.label`)}
                </CardTitle>
                <CardDescription>
                  {t(`sections.${key}.description`)}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
