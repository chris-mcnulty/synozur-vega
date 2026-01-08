import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Layers } from "lucide-react";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CapabilitySection, CapabilityTab } from "@shared/schema";

export function CapabilityShowcase() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string>("");

  const { data: section, isLoading: sectionLoading } = useQuery<CapabilitySection>({
    queryKey: ["/api/capability-section"],
  });

  const { data: tabs = [], isLoading: tabsLoading } = useQuery<CapabilityTab[]>({
    queryKey: ["/api/capability-tabs"],
  });

  if (sectionLoading || tabsLoading) {
    return null;
  }

  if (!section?.enabled || tabs.length === 0) {
    return null;
  }

  const defaultTab = activeTab || tabs[0]?.id || "";

  if (isMobile) {
    return (
      <section className="py-12 md:py-20 bg-muted/30" data-testid="capability-showcase-section">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">
              <Layers className="h-3 w-3 mr-1" />
              Capabilities
            </Badge>
            <h2 className="text-2xl md:text-3xl font-semibold mb-2">{section.headline}</h2>
            {section.subHeadline && (
              <p className="text-muted-foreground">{section.subHeadline}</p>
            )}
          </div>

          <Accordion type="single" collapsible className="space-y-3" data-testid="capability-accordion">
            {tabs.map((tab) => (
              <AccordionItem 
                key={tab.id} 
                value={tab.id} 
                className="border rounded-lg bg-background px-4"
                data-testid={`capability-accordion-item-${tab.id}`}
              >
                <AccordionTrigger className="text-left py-4 hover:no-underline">
                  <span className="font-medium">{tab.tabLabel}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    {tab.primaryImageUrl && (
                      <div className="rounded-lg overflow-hidden">
                        <img 
                          src={tab.primaryImageUrl} 
                          alt={tab.heading}
                          className="w-full h-auto object-cover"
                          data-testid={`capability-image-${tab.id}`}
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{tab.heading}</h3>
                      <div className="prose prose-sm max-w-none text-muted-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {tab.bodyCopy}
                        </ReactMarkdown>
                      </div>
                    </div>
                    {tab.ctaText && tab.ctaUrl && (
                      <div>
                        {tab.ctaUrl.startsWith('/') ? (
                          <Link href={tab.ctaUrl}>
                            <Button size="sm" data-testid={`capability-cta-${tab.id}`}>
                              {tab.ctaText}
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                        ) : (
                          <a href={tab.ctaUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" data-testid={`capability-cta-${tab.id}`}>
                              {tab.ctaText}
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </a>
                        )}
                      </div>
                    )}
                    {tab.secondaryImageUrl && (
                      <div className="rounded-lg overflow-hidden mt-4">
                        <img 
                          src={tab.secondaryImageUrl} 
                          alt={`${tab.heading} detail`}
                          className="w-full h-auto object-cover"
                          data-testid={`capability-secondary-image-${tab.id}`}
                        />
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-muted/30" data-testid="capability-showcase-section">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Layers className="h-3 w-3 mr-1" />
            Capabilities
          </Badge>
          <h2 className="text-3xl md:text-4xl font-semibold mb-3">{section.headline}</h2>
          {section.subHeadline && (
            <p className="text-muted-foreground max-w-2xl mx-auto">{section.subHeadline}</p>
          )}
        </div>

        <Tabs 
          value={defaultTab} 
          onValueChange={setActiveTab} 
          orientation="vertical" 
          className="flex gap-6"
          data-testid="capability-tabs"
        >
          <ScrollArea className="h-[400px] w-[220px] shrink-0">
            <TabsList className="flex flex-col h-auto w-full bg-transparent gap-2 p-1">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="w-full justify-start px-4 py-3 text-left data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all"
                  data-testid={`capability-tab-trigger-${tab.id}`}
                >
                  {tab.tabLabel}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <div className="flex-1">
            {tabs.map((tab) => (
              <TabsContent 
                key={tab.id} 
                value={tab.id} 
                className="mt-0"
                data-testid={`capability-tab-content-${tab.id}`}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                      <div className="p-6 lg:p-8 flex flex-col justify-center">
                        <h3 className="text-2xl font-semibold mb-4">{tab.heading}</h3>
                        <div className="prose prose-sm max-w-none text-muted-foreground mb-6">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {tab.bodyCopy}
                          </ReactMarkdown>
                        </div>
                        {tab.ctaText && tab.ctaUrl && (
                          <div>
                            {tab.ctaUrl.startsWith('/') ? (
                              <Link href={tab.ctaUrl}>
                                <Button data-testid={`capability-cta-${tab.id}`}>
                                  {tab.ctaText}
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </Link>
                            ) : (
                              <a href={tab.ctaUrl} target="_blank" rel="noopener noreferrer">
                                <Button data-testid={`capability-cta-${tab.id}`}>
                                  {tab.ctaText}
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-muted/50 min-h-[300px] flex flex-col">
                        {tab.primaryImageUrl ? (
                          <div className="flex-1 relative">
                            <img 
                              src={tab.primaryImageUrl} 
                              alt={tab.heading}
                              className="absolute inset-0 w-full h-full object-cover"
                              data-testid={`capability-image-${tab.id}`}
                            />
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center">
                            <Layers className="h-16 w-16 text-muted-foreground/30" />
                          </div>
                        )}
                        {tab.secondaryImageUrl && (
                          <div className="h-24 border-t border-border/50">
                            <img 
                              src={tab.secondaryImageUrl} 
                              alt={`${tab.heading} detail`}
                              className="w-full h-full object-cover"
                              data-testid={`capability-secondary-image-${tab.id}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </section>
  );
}
