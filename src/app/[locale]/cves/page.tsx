import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CveArchive } from "@/components/cves/cve-archive";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cves" });
  return {
    title: t("title"),
  };
}

export default async function CvesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto w-[90vw] max-w-[1400px] px-4 py-8">
      <CveArchive />
    </div>
  );
}
