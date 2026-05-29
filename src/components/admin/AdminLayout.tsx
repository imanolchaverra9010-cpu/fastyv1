import { ReactNode } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminPushSetup } from "@/components/admin/AdminPushSetup";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  breadcrumb: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  hidePageHeader?: boolean;
  children: ReactNode;
  className?: string;
}

export function AdminLayout({
  breadcrumb,
  eyebrow,
  title,
  description,
  headerActions,
  toolbar,
  hidePageHeader = false,
  children,
  className,
}: AdminLayoutProps) {
  const showPageHeader = !hidePageHeader && (eyebrow || title || description || toolbar);

  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full bg-gradient-warm">
        <AdminSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 shrink-0 border-b border-border/50 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 pt-[env(safe-area-inset-top,0px)]">
            <div className="flex min-h-[3.25rem] items-center gap-1.5 px-3 py-2 sm:min-h-14 sm:gap-2 sm:px-4 md:px-6">
              <SidebarTrigger
                className="-ml-0.5 h-10 w-10 shrink-0 rounded-xl text-foreground hover:bg-muted/70 active:scale-95 transition-transform"
                aria-label="Abrir menú"
              />
              <div className="hidden h-5 w-px shrink-0 bg-border/60 sm:block" />
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground sm:text-[0.9375rem]">
                {breadcrumb}
              </h2>
              {headerActions && (
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{headerActions}</div>
              )}
            </div>
          </header>

          <main
            className={cn(
              "mx-auto w-full min-w-0 max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-5 md:px-8 md:py-8",
              "pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
              className,
            )}
          >
            {showPageHeader && (
              <div className="mb-5 sm:mb-6 md:mb-8">
                {eyebrow && (
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary sm:text-xs md:text-sm md:normal-case md:tracking-normal">
                    {eyebrow}
                  </p>
                )}
                {title && (
                  <h1 className="mt-0.5 font-display text-xl font-bold tracking-tight sm:text-2xl md:mt-1 md:text-4xl">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</p>
                )}
                {toolbar && (
                  <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap">{toolbar}</div>
                )}
              </div>
            )}
            {children}
          </main>
        </SidebarInset>
        <AdminPushSetup />
      </div>
    </SidebarProvider>
  );
}
