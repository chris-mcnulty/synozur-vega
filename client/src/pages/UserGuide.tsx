import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronUp, BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
}

export default function UserGuide() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { data: content, isLoading, error } = useQuery<string>({
    queryKey: ["/api/user-guide"],
    queryFn: async () => {
      const response = await fetch("/api/user-guide");
      if (!response.ok) throw new Error("Failed to load user guide");
      return response.text();
    },
  });

  // Extract table of contents from markdown headings
  const tableOfContents = useMemo(() => {
    if (!content) return [];
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
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

  // Filter content based on search
  const filteredContent = useMemo(() => {
    if (!content || !searchTerm.trim()) return content;
    
    // Highlight search terms
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return content.replace(regex, '**$1**');
  }, [content, searchTerm]);

  // Scroll to top button visibility
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
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">User Guide</h1>
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
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Guide</h2>
            <p className="text-muted-foreground">
              The user guide could not be loaded. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-page-title">User Guide</h1>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search guide..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-guide"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table of Contents - Sticky Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Contents
              </h3>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <nav className="space-y-1">
                  {tableOfContents.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToSection(item.id)}
                      className={`block w-full text-left text-sm py-1 hover:text-primary transition-colors truncate ${
                        item.level === 1 
                          ? "font-semibold" 
                          : item.level === 2 
                            ? "pl-3 text-muted-foreground" 
                            : "pl-6 text-muted-foreground text-xs"
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

        {/* Main Content */}
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
                      img: ({ src, alt, ...props }) => (
                        <img 
                          src={src} 
                          alt={alt} 
                          className="rounded-lg border shadow-sm max-w-full" 
                          loading="lazy"
                          {...props} 
                        />
                      ),
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
                      table: ({ children, ...props }) => (
                        <div className="overflow-x-auto">
                          <table className="min-w-full" {...props}>{children}</table>
                        </div>
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

      {/* Scroll to top button */}
      {showScrollTop && (
        <Button
          size="icon"
          variant="secondary"
          className="fixed bottom-6 right-6 shadow-lg"
          onClick={scrollToTop}
          data-testid="button-scroll-top"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
