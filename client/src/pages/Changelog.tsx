import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronUp, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
}

export default function Changelog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { data: content, isLoading, error } = useQuery<string>({
    queryKey: ["/api/changelog"],
    queryFn: async () => {
      const response = await fetch("/api/changelog");
      if (!response.ok) throw new Error("Failed to load changelog");
      return response.text();
    },
  });

  const tableOfContents = useMemo(() => {
    if (!content) return [];
    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    const items: TableOfContentsItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2];
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      items.push({ id, title, level });
    }

    return items;
  }, [content]);

  const filteredContent = useMemo(() => {
    if (!content || !searchTerm.trim()) return content;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return content.replace(regex, '**$1**');
  }, [content, searchTerm]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        setShowScrollTop(scrollContainer.scrollTop > 300);
      }
    };

    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
    scrollContainer?.addEventListener('scroll', handleScroll);
    return () => scrollContainer?.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Changelog</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-[600px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Changelog</h2>
            <p className="text-muted-foreground">
              The changelog could not be loaded. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Changelog</h1>
            <p className="text-sm text-muted-foreground">What's new in Vega</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search changelog..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-changelog"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card className="sticky top-4 z-50">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Versions
              </h3>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <nav className="space-y-1">
                  {tableOfContents.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToSection(item.id)}
                      className={`block w-full text-left text-sm py-1 hover:text-primary transition-colors truncate ${
                        item.level === 2
                          ? "font-semibold"
                          : "pl-3 text-muted-foreground"
                      }`}
                      data-testid={`link-toc-${item.id}`}
                    >
                      {item.title}
                    </button>
                  ))}
                </nav>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-8">
              <ScrollArea className="h-[calc(100vh-220px)]">
                <article className="prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children, ...props }) => {
                        const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                        return <h1 id={id} className="scroll-mt-20" {...props}>{children}</h1>;
                      },
                      h2: ({ children, ...props }) => {
                        const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                        return <h2 id={id} className="scroll-mt-20" {...props}>{children}</h2>;
                      },
                      h3: ({ children, ...props }) => {
                        const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                        return <h3 id={id} className="scroll-mt-20" {...props}>{children}</h3>;
                      },
                      a: ({ href, children, ...props }) => (
                        <a
                          href={href}
                          className="text-primary hover:underline"
                          target={href?.startsWith('http') ? '_blank' : undefined}
                          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {filteredContent || ""}
                  </ReactMarkdown>
                </article>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {showScrollTop && (
        <Button
          size="icon"
          variant="secondary"
          className="fixed bottom-6 right-6 shadow-lg"
          onClick={scrollToTop}
          data-testid="button-scroll-top"
          aria-label="Scroll to top"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
