import { ImageResponse } from 'next/og'
import { routing } from '@/i18n/routing'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}
// Note: intentionally NOT declaring `export const runtime = 'edge'`.
// With `output: 'export'` (static export), declaring the edge runtime
// causes `next build` to error. `next/og` works at build time in the
// default Node runtime when the static export target is set.

export const alt = 'Seungpyo Hong — Vulnerability Research & OT/ICS Security'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        backgroundColor: '#0a0a0a',
        backgroundImage:
          'radial-gradient(circle at 82% 18%, rgba(159, 239, 0, 0.18), transparent 30%)',
        color: '#ededed',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          color: '#9fef00',
          fontSize: 22,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: 32,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: '#9fef00',
          }}
        />
        Vulnerability research · systems that ship
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 84,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.04em',
        }}
      >
        Seungpyo <span style={{ color: '#9fef00', marginLeft: 18 }}>Hong</span>
      </div>
      <div
        style={{ fontSize: 38, lineHeight: 1.25, color: '#b8b8b8', maxWidth: 930, marginTop: 34 }}
      >
        Taking apart kernels, industrial devices, and firmware, and proving the flaws with working exploits.
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 42 }}>
        {['OT/ICS', 'IoT & firmware', 'Linux kernel'].map((label) => (
          <div
            key={label}
            style={{
              display: 'flex',
              border: '1px solid #2e2e2e',
              borderRadius: 8,
              padding: '10px 16px',
              color: '#8a8a8a',
              fontSize: 20,
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid #242424',
          paddingTop: 24,
          marginTop: 42,
          color: '#777',
          fontSize: 19,
        }}
      >
        <span>Offensive Security Researcher</span>
        <span>blog.ph4nt0m.xyz</span>
      </div>
    </div>,
    { ...size },
  )
}
