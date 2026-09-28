import { GoogleAnalytics } from '@next/third-parties/google'
import { routing } from '@/i18n/routing'
import '@/app/globals.css'

/*
 * bare "/" 전용 루트 레이아웃. 이 경로는 app/[locale] 밖이라 로케일 param 이 없어
 * <html lang> 에 넣을 값이 defaultLocale 뿐이다. 실제 페이지는 모두 app/[locale]/
 * layout.tsx 아래에서 렌더된다(Next.js "multiple root layouts", route group 마다
 * html/body 하나). 여기 page.tsx 가 브라우저 언어를 보고 /ko 또는 /en 으로 보낸다.
 */
export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={routing.defaultLocale} suppressHydrationWarning className="scroll-smooth">
      <body suppressHydrationWarning>{children}</body>
      <GoogleAnalytics gaId="G-KV41V41G5J" />
    </html>
  )
}
