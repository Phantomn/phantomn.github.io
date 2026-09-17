import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Shared provider stack for both root layouts (app/(root)/layout.tsx and
 * app/[locale]/layout.tsx) so theme/tooltip setup can't drift apart.
 */
export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
