import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, ExternalLink, Check, Download, Upload, History, MessageSquare, Eye, Edit } from "lucide-react";
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
  mission: string[];
  vision: string[];
  values: string[];
  goals: string[];
  comments: string;
  updatedBy: string;
  updatedAt: string;
};

const mockHistory: HistoryEntry[] = [
  {
    year: 2025,
    mission: ["Empower organizations with AI-driven insights", "Transform strategy into actionable results"],
    vision: ["A world where every organization operates with clarity", "Data-driven decision-making at every level"],
    values: ["Innovation", "Integrity", "Collaboration", "Excellence", "Customer Success"],
    goals: ["Increase revenue by 30%", "Expand to new markets", "Improve customer satisfaction"],
    comments: "Updated for strategic alignment with Q1 goals and market expansion",
    updatedBy: "Sarah Chen",
    updatedAt: "2025-01-15",
  },
  {
    year: 2024,
    mission: ["Empower organizations with AI-driven insights"],
    vision: ["A world where every organization operates with clarity"],
    values: ["Innovation", "Customer Success", "Excellence"],
    goals: ["Increase revenue by 30%", "Launch innovative products"],
    comments: "Refined values based on team feedback and market positioning",
    updatedBy: "Michael Torres",
    updatedAt: "2024-03-20",
  },
  {
    year: 2023,
    mission: ["Transform strategy into actionable results"],
    vision: ["Data-driven decision-making at every level"],
    values: ["Innovation", "Collaboration"],
    goals: ["Improve customer satisfaction"],
    comments: "Initial foundation establishment",
    updatedBy: "Alex Kim",
    updatedAt: "2023-01-10",
  },
];

export default function Foundations() {
  const { toast } = useToast();
  const [selectedMission, setSelectedMission] = useState<string[]>([
    "Empower organizations with AI-driven insights",
    "Transform strategy into actionable results",
  ]);
  const [selectedVision, setSelectedVision] = useState<string[]>([
    "A world where every organization operates with clarity",
    "Data-driven decision-making at every level",
  ]);
  const [selectedValues, setSelectedValues] = useState<string[]>([
    "Innovation",
    "Integrity",
    "Collaboration",
    "Excellence",
    "Customer Success",
  ]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    "Increase revenue by 30%",
    "Expand to new markets",
    "Improve customer satisfaction",
  ]);

  const [missionComments, setMissionComments] = useState(
    "Our mission reflects our commitment to empowering organizations through AI-driven solutions and actionable insights."
  );
  const [visionComments, setVisionComments] = useState(
    "We envision a future where clarity and data-driven decisions are the norm for all organizations."
  );
  const [valuesComments, setValuesComments] = useState(
    "These core values guide every decision we make and shape our company culture."
  );
  const [goalsComments, setGoalsComments] = useState(
    "Strategic goals aligned with our 2025 growth objectives and market expansion plans."
  );

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
          const rows = text.split("\n").slice(1);
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
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="selection" data-testid={`tab-selection-${sectionKey}`}>
              Selection
            </TabsTrigger>
            <TabsTrigger value="comments" data-testid={`tab-comments-${sectionKey}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments
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
                <Label htmlFor={`comments-${sectionKey}`}>Comments & Notes</Label>
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
        </Tabs>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Foundations</h1>
        <p className="text-muted-foreground">
          Define your organization's core purpose, values, and strategic goals
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Eye className="h-4 w-4 mr-2" />
            Master View
          </TabsTrigger>
          <TabsTrigger value="edit" data-testid="tab-edit">
            <Edit className="h-4 w-4 mr-2" />
            Edit Sections
          </TabsTrigger>
          <TabsTrigger value="annual" data-testid="tab-annual-view">
            <History className="h-4 w-4 mr-2" />
            Annual History
          </TabsTrigger>
        </TabsList>

        {/* Master Overview - Read-only */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Organizational Foundations</CardTitle>
                <Badge variant="default">Current - 2025</Badge>
              </div>
              <CardDescription>
                A comprehensive view of your organization's mission, vision, values, and strategic goals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Mission */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-12 bg-primary rounded" />
                  <h2 className="text-xl font-bold">Mission Statement</h2>
                </div>
                <div className="bg-background rounded-lg p-6 space-y-3">
                  {selectedMission.length > 0 ? (
                    selectedMission.map((item, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <p className="text-base leading-relaxed">{item}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground italic">No mission components selected</p>
                  )}
                  {missionComments && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground italic">{missionComments}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Vision */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-12 bg-secondary rounded" />
                  <h2 className="text-xl font-bold">Vision Statement</h2>
                </div>
                <div className="bg-background rounded-lg p-6 space-y-3">
                  {selectedVision.length > 0 ? (
                    selectedVision.map((item, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="h-2 w-2 rounded-full bg-secondary mt-2 flex-shrink-0" />
                        <p className="text-base leading-relaxed">{item}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground italic">No vision components selected</p>
                  )}
                  {visionComments && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground italic">{visionComments}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Values */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-12 bg-primary rounded" />
                  <h2 className="text-xl font-bold">Core Values</h2>
                </div>
                <div className="bg-background rounded-lg p-6">
                  {selectedValues.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedValues.map((value, index) => (
                        <div
                          key={index}
                          className="bg-primary/10 rounded-lg p-4 text-center font-medium"
                        >
                          {value}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No values selected</p>
                  )}
                  {valuesComments && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground italic">{valuesComments}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Strategic Goals */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-12 bg-secondary rounded" />
                  <h2 className="text-xl font-bold">Strategic Goals</h2>
                </div>
                <div className="bg-background rounded-lg p-6 space-y-3">
                  {selectedGoals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedGoals.map((goal, index) => (
                        <Card key={index} className="bg-secondary/10">
                          <CardContent className="p-4 flex items-start gap-3">
                            <Badge variant="secondary" className="mt-0.5">
                              {index + 1}
                            </Badge>
                            <p className="text-sm leading-relaxed">{goal}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No goals selected</p>
                  )}
                  {goalsComments && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground italic">{goalsComments}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Sections */}
        <TabsContent value="edit" className="space-y-6">
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
        </TabsContent>

        {/* Annual History View */}
        <TabsContent value="annual">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Annual Foundation History</h2>
              <Badge variant="outline">{mockHistory.length} years</Badge>
            </div>
            <div className="space-y-6">
              {mockHistory.map((entry, index) => (
                <Card key={index} data-testid={`history-entry-${index}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-2xl">{entry.year}</CardTitle>
                        <CardDescription className="mt-1">
                          Updated by {entry.updatedBy} on {entry.updatedAt}
                        </CardDescription>
                      </div>
                      <Badge variant={index === 0 ? "default" : "secondary"}>
                        {index === 0 ? "Current" : "Archive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {entry.comments && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm font-medium mb-1">Annual Notes:</p>
                        <p className="text-sm text-muted-foreground">{entry.comments}</p>
                      </div>
                    )}

                    {/* Mission */}
                    {entry.mission.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <div className="h-1 w-8 bg-primary rounded" />
                          Mission
                        </h3>
                        <ul className="list-disc list-inside space-y-1">
                          {entry.mission.map((item, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Vision */}
                    {entry.vision.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <div className="h-1 w-8 bg-secondary rounded" />
                          Vision
                        </h3>
                        <ul className="list-disc list-inside space-y-1">
                          {entry.vision.map((item, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Values */}
                    {entry.values.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <div className="h-1 w-8 bg-primary rounded" />
                          Core Values
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {entry.values.map((value, idx) => (
                            <Badge key={idx} variant="outline">
                              {value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Goals */}
                    {entry.goals.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <div className="h-1 w-8 bg-secondary rounded" />
                          Strategic Goals
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {entry.goals.map((goal, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <Badge variant="secondary" className="mt-0.5">
                                {idx + 1}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{goal}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
