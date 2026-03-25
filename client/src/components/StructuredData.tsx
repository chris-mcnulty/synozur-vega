import { Helmet } from "react-helmet-async";

type SoftwareApplicationSchema = {
  "@type": "SoftwareApplication";
  name: string;
  description: string;
  applicationCategory: string;
  operatingSystem: string;
  url: string;
  publisher: {
    "@type": "Organization";
    name: string;
    url: string;
  };
  offers?: {
    "@type": "Offer";
    price: string;
    priceCurrency: string;
  };
};

type OrganizationSchema = {
  "@type": "Organization";
  name: string;
  url: string;
  logo: string;
  sameAs: string[];
  description?: string;
};

type SchemaData = SoftwareApplicationSchema | OrganizationSchema;

interface StructuredDataProps {
  schemas: SchemaData[];
}

export function StructuredData({ schemas }: StructuredDataProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": schemas,
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
    </Helmet>
  );
}

export function LandingStructuredData({ 
  config 
}: { 
  config?: { 
    title?: string; 
    description?: string; 
    canonicalUrl?: string; 
  } 
}) {
  const baseUrl = config?.canonicalUrl || "https://vega.synozur.com";
  const description = config?.description || "Vega delivers the ultimate Company Operating System experience with AI-powered foundations, strategy, planning, and focus rhythm modules for modern organizations.";

  const schemas: SchemaData[] = [
    {
      "@type": "SoftwareApplication",
      name: "Vega",
      description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: baseUrl,
      publisher: {
        "@type": "Organization",
        name: "Synozur Alliance",
        url: "https://www.synozur.com",
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "Organization",
      name: "Synozur Alliance",
      url: "https://www.synozur.com",
      logo: `${baseUrl}/og-image.png`,
      sameAs: [
        "https://www.linkedin.com/company/synozur",
        "https://www.microsoft.com/en-us/microsoft-cloud/blog/partner/synozur/",
      ],
      description: "Synozur Alliance is a woman-owned advisory firm specializing in business transformation through their proven Company Operating System.",
    },
  ];

  return <StructuredData schemas={schemas} />;
}
