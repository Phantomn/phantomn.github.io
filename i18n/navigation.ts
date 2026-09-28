import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// 로케일을 붙여 주는 Link/router. 컴포넌트는 next/link 대신 이걸 쓴다.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
