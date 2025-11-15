import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, ExternalLink, Check, Download, Upload, History, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const missionOptions = [
  "Empower organizations with AI-driven insights",
  "Transform strategy into actionable results",
  "Foster innovation and sustainable growth",
  "Enable data-driven decision-making",
];

const visionOptions = [
  "A world where every organization operates with clarity",
  "Data-driven decision-making at every level",
  "Sustainable growth through innovation",
  "Seamless alignment between strategy and execution",
];

const valueOptions = [
  "Innovation",
  "Integrity",
  "Collaboration",
  "Excellence",
  "Customer Success",
  "Transparency",
  "Accountability",
  "Continuous Learning",
  "Respect",
  "Agility",
];

const goalOptions = [
  "Increase revenue by 30%",
  "Expand to new markets",
  "Improve customer satisfaction",
  "Launch innovative products",
  "Build high-performing teams",
  "Achieve operational excellence",
  "Strengthen brand presence",
  "Foster sustainable practices",
];

type HistoryEntry = {
  year: number;
  items: string[];
  comments: string;
  updatedBy: string;
  updatedAt: string;
};

const mockHistory: HistoryEntry[] = [
  {
    year: 2025,
    items: ["Current selections"],
    comments: "Updated for strategic alignment with Q1 goals",
    updatedBy: "Sarah Chen",
    updatedAt: "2025-01-15",
  },
  {
    year: 2024,
    items: ["Innovation", "Customer Success", "Excellence"],
    comments: "Refined values based on team feedback and market positioning",
    updatedBy: "Michael Torres",
    updatedAt: "2024-03-20",
  },
  {
    year: 2023,
    items: ["Innovation", "Collaboration"],
    comments: "Initial foundation establishment",
    updatedBy: "Alex Kim",
    updatedAt: "2023-01-10",
  },
];

export default function Foundations() {
  const { toast } = useToast();
  const [selectedMission, setSelectedMission] = useState<string[]>([]);
  const [selectedVision, setSelectedVision] = useState<string[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const [missionComments, setMissionComments] = useState("");
  const [visionComments, setVisionComments] = useState("");
  const [valuesComments, setValuesComments] = useState("");
  const [goalsComments, setGoalsComments] = useState("");

  const toggleSelection = (
    item: string,
    selected: string[],
    setSelected: (items: string[]) => void
  ) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  const openNebulaWorkspace = (section: string) => {
    console.log(`Opening Nebula workspace for ${section} ideation`);
    toast({
      title: "Opening Nebula Workspace",
      description: `Launching AI ideation for ${section}...`,
    });
  };

  const exportToCSV = (section: string, data: string[], comments: string) => {
    const csvContent = [
      ["Section", "Item", "Comments"],
      ...data.map((item) => [section, item, comments]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${section.toLowerCase()}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `${section} data exported to CSV`,
    });
  };

  const importFromCSV = (section: string, setSelected: (items: string[]) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const rows = text.split("\n").slice(1); // Skip header
          const items = rows
            .map((row) => {
              const match = row.match(/"([^"]+)"/g);
              return match ? match[1]?.replace(/"/g, "") : "";
            })
            .filter(Boolean);
          setSelected(items);
          toast({
            title: "Import Successful",
            description: `${items.length} items imported for ${section}`,
          });
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const renderSection = (
    title: string,
    description: string,
    options: string[],
    selected: string[],
    setSelected: (items: string[]) => void,
    comments: string,
    setComments: (value: string) => void,
    sectionKey: string,
    isBadgeStyle = false
  ) => (
    <Card data-testid={`card-${sectionKey}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => exportToCSV(title, selected, comments)}
              data-testid={`button-export-${sectionKey}`}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => importFromCSV(title, setSelected)}
              data-testid={`button-import-${sectionKey}`}
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openNebulaWorkspace(title)}
              data-testid={`button-nebula-${sectionKey}`}
            >
              <Sparkles className="h-4 w-4" />
              Open in Nebula
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="selection" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="selection" data-testid={`tab-selection-${sectionKey}`}>
              Selection
            </TabsTrigger>
            <TabsTrigger value="comments" data-testid={`tab-comments-${sectionKey}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="history" data-testid={`tab-history-${sectionKey}`}>
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="selection" className="space-y-4">
            {isBadgeStyle ? (
              <div className="flex flex-wrap gap-2">
                {options.map((option, index) => (
                  <Badge
                    key={index}
                    variant={selected.includes(option) ? "default" : "outline"}
                    className={`cursor-pointer py-2 px-4 text-sm ${
                      selected.includes(option) ? "" : "hover-elevate"
                    }`}
                    onClick={() => toggleSelection(option, selected, setSelected)}
                    data-testid={`option-${sectionKey}-${index}`}
                  >
                    {selected.includes(option) && <Check className="h-3 w-3 mr-1" />}
                    {option}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {options.map((option, index) => (
                  <Card
                    key={index}
                    className={`cursor-pointer transition-all hover-elevate ${
                      selected.includes(option) ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => toggleSelection(option, selected, setSelected)}
                    data-testid={`option-${sectionKey}-${index}`}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <div
                        className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          selected.includes(option)
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {selected.includes(option) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <p className="text-sm">{option}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selected.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-3">
                  {selected.length} item{selected.length !== 1 ? "s" : ""} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.map((item, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      data-testid={`badge-${sectionKey}-${index}`}
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="comments">
            <div className="space-y-4">
              <div>
                <Label htmlFor={`comments-${sectionKey}`}>
                  Comments & Notes
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Add context, rationale, or additional notes for this section
                </p>
                <Textarea
                  id={`comments-${sectionKey}`}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter your comments and notes here..."
                  rows={8}
                  data-testid={`input-comments-${sectionKey}`}
                />
              </div>
              <Button
                onClick={() => {
                  toast({
                    title: "Comments Saved",
                    description: `Your ${title} comments have been saved`,
                  });
                }}
                data-testid={`button-save-comments-${sectionKey}`}
              >
                Save Comments
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Annual History</h3>
                <Badge variant="outline">{mockHistory.length} years</Badge>
              </div>
              <div className="space-y-4">
                {mockHistory.map((entry, index) => (
                  <Card key={index} data-testid={`history-entry-${sectionKey}-${index}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-lg">{entry.year}</CardTitle>
                          <CardDescription className="mt-1">
                            Updated by {entry.updatedBy} on {entry.updatedAt}
                          </CardDescription>
                        </div>
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          {index === 0 ? "Current" : "Archive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-2">Selected Items:</p>
                        <div className="flex flex-wrap gap-2">
                          {entry.items.map((item, idx) => (
                            <Badge key={idx} variant="outline">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {entry.comments && (
                        <div>
                          <p className="text-sm font-medium mb-1">Comments:</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.comments}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Foundations</h1>
        <p className="text-muted-foreground">
          Define your organization's core purpose, values, and strategic goals
        </p>
      </div>

      {renderSection(
        "Mission Statement",
        "What is your organization's fundamental purpose?",
        missionOptions,
        selectedMission,
        setSelectedMission,
        missionComments,
        setMissionComments,
        "mission"
      )}

      {renderSection(
        "Vision Statement",
        "What future do you aspire to create?",
        visionOptions,
        selectedVision,
        setSelectedVision,
        visionComments,
        setVisionComments,
        "vision"
      )}

      {renderSection(
        "Core Values",
        "What principles guide your organization? (Select multiple)",
        valueOptions,
        selectedValues,
        setSelectedValues,
        valuesComments,
        setValuesComments,
        "values",
        true
      )}

      {renderSection(
        "Strategic Goals",
        "What are your key organizational objectives? (Select multiple)",
        goalOptions,
        selectedGoals,
        setSelectedGoals,
        goalsComments,
        setGoalsComments,
        "goals"
      )}

      <Separator className="my-8" />

      {/* Summary Section */}
      {(selectedMission.length > 0 ||
        selectedVision.length > 0 ||
        selectedValues.length > 0 ||
        selectedGoals.length > 0) && (
        <Card data-testid="card-summary">
          <CardHeader>
            <CardTitle>Foundations Summary</CardTitle>
            <CardDescription>
              Your selected organizational foundations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedMission.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Mission Components</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {selectedMission.map((item, index) => (
                    <li key={index} className="text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedVision.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Vision Components</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {selectedVision.map((item, index) => (
                    <li key={index} className="text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedValues.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Core Values</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedValues.map((item, index) => (
                    <Badge key={index} variant="secondary">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedGoals.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Strategic Goals</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {selectedGoals.map((item, index) => (
                    <li key={index} className="text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
