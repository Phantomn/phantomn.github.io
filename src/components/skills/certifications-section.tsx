"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  Minimize,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";

import type { CertCompanyGroup, CertItem } from "@/types/profile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getDownloadName(src: string) {
  try {
    const u = new URL(src, window.location.origin);
    return u.pathname.split("/").pop() ?? "certification";
  } catch {
    return "certification";
  }
}

function CertImageModal({
  open,
  onClose,
  company,
  certs,
  initialIndex = 0,
}: {
  open: boolean;
  onClose: () => void;
  company: string;
  certs: CertItem[];
  initialIndex?: number;
}) {
  const [certIndex, setCertIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  const activeCert = certs[certIndex] ?? null;

  useEffect(() => {
    if (!open) return;
    setCertIndex(initialIndex);
    setZoom(1);
    setFullscreen(false);
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        setCertIndex((i) => (i - 1 + certs.length) % certs.length);
      }
      if (e.key === "ArrowRight") {
        setCertIndex((i) => (i + 1) % certs.length);
      }
      if (e.key === "+" || e.key === "=") {
        setZoom((z) => clamp(z + 0.25, 0.75, 3));
      }
      if (e.key === "-" || e.key === "_") {
        setZoom((z) => clamp(z - 0.25, 0.75, 3));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, certs.length, onClose]);

  const goPrev = () =>
    setCertIndex((i) => (i - 1 + certs.length) % certs.length);
  const goNext = () => setCertIndex((i) => (i + 1) % certs.length);

  if (!open || !activeCert) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4",
        fullscreen && "p-0"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative mx-auto flex min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-background shadow-lg",
          "max-h-[92vh]",
          fullscreen &&
            "h-full max-h-none max-w-none rounded-none border-0 shadow-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col gap-3 border-b bg-background/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-muted-foreground">
                {company}
              </span>
              <span className="text-sm text-muted-foreground">
                {certIndex + 1}/{certs.length}
              </span>
            </div>
            <div className="truncate text-base font-semibold">
              {activeCert.title}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Previous certification">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goNext} aria-label="Next certification">
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => clamp(z - 0.25, 0.75, 3))}
              aria-label="Zoom out"
              disabled={zoom <= 0.75}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => clamp(z + 0.25, 0.75, 3))}
              aria-label="Zoom in"
              disabled={zoom >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setFullscreen((f) => !f);
                setZoom(1);
              }}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen view"}
            >
              {fullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(1)}
              aria-label="Reset zoom"
              disabled={zoom === 1}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label="Download certification"
            >
              <a href={activeCert.src} download={getDownloadName(activeCert.src)}>
                <Download className="h-4 w-4" />
              </a>
            </Button>

            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close modal">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-auto p-4",
            fullscreen && "p-2"
          )}
        >
          <div
            className={cn(
              "flex min-h-full justify-center",
              fullscreen ? "items-center py-2" : "items-start py-2"
            )}
          >
            <div
              className="inline-block max-w-full"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
              }}
            >
              {activeCert.src ? (
                <img
                  src={activeCert.src}
                  alt={activeCert.title}
                  className={cn(
                    "block h-auto w-auto max-w-full object-contain",
                    fullscreen
                      ? "max-h-[calc(100dvh-5.5rem)]"
                      : "max-h-[calc(92vh-8.5rem)]"
                  )}
                />
              ) : (
                <div className="flex h-40 w-80 items-center justify-center rounded bg-muted text-sm text-muted-foreground">
                  {activeCert.title}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CertificationsSection({
  groups,
}: {
  groups: CertCompanyGroup[];
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modalState, setModalState] = useState<{
    open: boolean;
    groupIdx: number;
    certIdx: number;
  }>({ open: false, groupIdx: 0, certIdx: 0 });

  const activeGroup = groups[modalState.groupIdx] ?? null;

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const openCert = (groupIdx: number, certIdx: number) => {
    setModalState({ open: true, groupIdx, certIdx });
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {groups.map((g, gIdx) => {
          const isExpanded = expanded.has(gIdx);
          return (
            <Card
              key={g.company}
              className={cn(
                "overflow-hidden p-0 transition-all",
                isExpanded && "col-span-full"
              )}
            >
              <button
                type="button"
                onClick={() => toggleExpand(gIdx)}
                className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-accent/50"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${g.company} certifications`}
              >
                {g.logo ? (
                  <img
                    src={g.logo}
                    alt={`${g.company} logo`}
                    className="h-12 w-12 shrink-0 rounded-md border bg-background object-contain p-1"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted text-base font-bold text-muted-foreground">
                    {g.company.trim().slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {g.company}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {g.certs.length} cert{g.certs.length === 1 ? "" : "s"}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {isExpanded && (
                <div className="border-t bg-muted/10 p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {g.certs.map((cert, cIdx) =>
                      cert.href ? (
                        <a
                          key={cert.title}
                          href={cert.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex cursor-pointer flex-col items-center gap-2 rounded-md border bg-background p-2 transition-colors hover:border-primary/40 hover:bg-accent/50"
                          title={cert.title}
                        >
                          {cert.src ? (
                            <img
                              src={cert.src}
                              alt={cert.title}
                              className="h-20 w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-20 w-full items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                              {cert.title}
                            </div>
                          )}
                          <div className="line-clamp-2 w-full text-center text-[10px] leading-tight text-muted-foreground group-hover:text-foreground">
                            {cert.title}
                          </div>
                        </a>
                      ) : (
                        <button
                          key={cert.src || cert.title}
                          type="button"
                          onClick={() => openCert(gIdx, cIdx)}
                          className="group flex cursor-pointer flex-col items-center gap-2 rounded-md border bg-background p-2 transition-colors hover:border-primary/40 hover:bg-accent/50"
                          title={cert.title}
                        >
                          {cert.src ? (
                            <img
                              src={cert.src}
                              alt={cert.title}
                              className="h-20 w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-20 w-full items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                              {cert.title}
                            </div>
                          )}
                          <div className="line-clamp-2 w-full text-center text-[10px] leading-tight text-muted-foreground group-hover:text-foreground">
                            {cert.title}
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {activeGroup && (
        <CertImageModal
          open={modalState.open}
          onClose={() => setModalState((s) => ({ ...s, open: false }))}
          company={activeGroup.company}
          certs={activeGroup.certs}
          initialIndex={modalState.certIdx}
        />
      )}
    </div>
  );
}

