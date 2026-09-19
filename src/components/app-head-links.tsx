/**
 * Shared <head> links for both root layouts (favicon, web fonts). Kept as one
 * component so the two independent root layouts can't drift out of sync.
 */
export function AppHeadLinks() {
  return (
    <>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link
        href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600&family=Signika:wght@500;700&family=Noto+Sans+KR:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
    </>
  );
}
