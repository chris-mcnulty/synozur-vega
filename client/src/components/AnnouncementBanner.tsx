import { useQuery } from "@tanstack/react-query";
import { X, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import type { SystemBanner } from "@shared/schema";

const DISMISSED_BANNER_KEY = "vega_dismissed_banner_id";

export function AnnouncementBanner() {
  const [isDismissed, setIsDismissed] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(DISMISSED_BANNER_KEY);
    if (stored) {
      setDismissedId(stored);
    }
  }, []);

  const { data: banner } = useQuery<SystemBanner | null>({
    queryKey: ["/api/banners/active"],
  });

  if (!banner) {
    return null;
  }

  if (isDismissed || dismissedId === banner.id) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_BANNER_KEY, banner.id);
    setIsDismissed(true);
  };

  const bgColor = banner.backgroundColor || "#3b82f6";
  const textColor = banner.textColor || "#ffffff";

  return (
    <div
      className="relative flex items-center justify-center gap-2 px-4 py-2 text-sm"
      style={{ backgroundColor: bgColor, color: textColor }}
      data-testid="announcement-banner"
    >
      <span data-testid="announcement-banner-content">{banner.content}</span>
      {banner.linkUrl && banner.linkText && (
        <a
          href={banner.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2 font-medium hover:opacity-80"
          style={{ color: textColor }}
          data-testid="announcement-banner-link"
        >
          {banner.linkText}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:opacity-70 transition-opacity"
        style={{ color: textColor }}
        aria-label="Dismiss announcement"
        data-testid="button-dismiss-banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
