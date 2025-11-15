import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Sparkles, GripVertical, Download, Upload, History, MessageSquare, Target, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Priority = {
  id: string;
  title: string;
  description: string;
  category: "critical" | "high" | "medium" | "low";
  linkedGoals: string[];
  comments: string;
};

const availableGoals = [
  "Increase revenue by 30%",
  "Expand to new markets",
  "Improve customer satisfaction",
  "Launch innovative products",
  "Build high-performing teams",
  "Achieve operational excellence",
  "Strengthen brand presence",
  "Foster sustainable practices",
];

type TimelineEntry = {
  period: string;
  year: number;
  quarter?: number;
  priorities: Priority[];
  notes: string;
  updatedBy: string;
  updatedAt: string;
};

const mockTimeline: TimelineEntry[] = [
  {
    period: "Q1 2025",
    year: 2025,
    quarter: 1,
    priorities: [
      {
        id: "1",
        title: "Launch New Product Line",
        description: "Develop and launch innovative AI-powered analytics suite",
        category: "critical",
        linkedGoals: ["Launch innovative products", "Increase revenue by 30%"],
        comments: "Focus on market differentiation and customer feedback integration",
      },
    ],
    notes: "Quarterly strategic focus on product innovation and market expansion",
    updatedBy: "Sarah Chen",
    updatedAt: "2025-01-15",
  },
  {
    period: "2024",
    year: 2024,
    priorities: [
      {
        id: "2",
        title: "Expand Market Presence",
        description: "Enter three new geographic markets in EMEA region",
        category: "high",
        linkedGoals: ["Expand to new markets", "Strengthen brand presence"],
        comments: "Target Germany, France, and UK initially",
      },
      {
        id: "3",
        title: "Improve Customer Retention",
        description: "Implement customer success program to reduce churn",
        category: "high",
        linkedGoals: ["Improve customer satisfaction"],
        comments: "Achieved 15% reduction in churn rate",
      },
    ],
    notes: "Annual focus on market expansion and customer retention",
    updatedBy: "Michael Torres",
    updatedAt: "2024-12-31",
  },
];

const mockPriorities: Priority[] = [
  {
    id: "1",
    title: "Launch New Product Line",
    description: "Develop and launch innovative AI-powered analytics suite",
    category: "critical",
    linkedGoals: ["Launch innovative products", "Increase revenue by 30%"],
    comments: "Focus on market differentiation and customer feedback integration",
  },
  {
    id: "2",
    title: "Expand Market Presence",
    description: "Enter three new geographic markets in EMEA region",
    category: "high",
    linkedGoals: ["Expand to new markets", "Strengthen brand presence"],
    comments: "Target Germany, France, and UK initially",
  },
  {
    id: "3",
    title: "Improve Customer Retention",
    description: "Implement customer success program to reduce churn",
    category: "high",
    linkedGoals: ["Improve customer satisfaction"],
    comments: "Implement proactive outreach and quarterly business reviews",
  },
];

const categories = [
  { key: "critical", label: "Critical", color: "destructive" },
  { key: "high", label: "High Priority", color: "default" },
  { key: "medium", label: "Medium Priority", color: "secondary" },
  { key: "low", label: "Low Priority", color: "outline" },
] as const;

export default function Strategy() {
  const { toast } = useToast();
  const [priorities, setPriorities] = useState<Priority[]>(mockPriorities);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<Priority | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const exportToCSV = () => {
    const csvContent = [
      ["Title", "Description", "Category", "Linked Goals", "Comments"],
      ...priorities.map((p) => [
        p.title,
        p.description,
        p.category,
        p.linkedGoals.join("; "),
        p.comments,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `strategy_priorities_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `${priorities.length} priorities exported to CSV`,
    });
  };

  const importFromCSV = () => {
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
          const imported = rows
            .map((row) => {
              const matches = row.match(/"([^"]*)"/g);
              if (!matches || matches.length < 5) return null;
              return {
                id: Date.now().toString() + Math.random(),
                title: matches[0].replace(/"/g, ""),
                description: matches[1].replace(/"/g, ""),
                category: matches[2].replace(/"/g, "") as Priority["category"],
                linkedGoals: matches[3].replace(/"/g, "").split("; ").filter(Boolean),
                comments: matches[4].replace(/"/g, ""),
              };
            })
            .filter(Boolean) as Priority[];
          
          setPriorities([...priorities, ...imported]);
          toast({
            title: "Import Successful",
            description: `${imported.length} priorities imported`,
          });
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const openEditDialog = (priority: Priority) => {
    setSelectedPriority(priority);
    setEditDialogOpen(true);
  };

  const updatePriority = (updates: Partial<Priority>) => {
    if (!selectedPriority) return;
    setPriorities(
      priorities.map((p) =>
        p.id === selectedPriority.id ? { ...p, ...updates } : p
      )
    );
    toast({
      title: "Priority Updated",
      description: "Strategic priority has been saved",
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Tabs defaultValue="priorities" className="w-full">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Strategy</h1>
            <p className="text-muted-foreground">
              Manage your strategic priorities and initiatives
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="gap-2"
              onClick={exportToCSV}
              data-testid="button-export-strategy"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={importFromCSV}
              data-testid="button-import-strategy"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button variant="outline" className="gap-2" data-testid="button-ai-draft">
              <Sparkles className="h-4 w-4" />
              Generate Draft
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-add-priority">
                  <Plus className="h-4 w-4" />
                  Add Priority
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Strategic Priority</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter priority title..."
                      data-testid="input-priority-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the strategic priority..."
                      rows={3}
                      data-testid="input-priority-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select priority level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="low">Low Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" data-testid="button-save-priority">
                    Create Priority
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="priorities" data-testid="tab-priorities">
            Current Priorities
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <History className="h-4 w-4 mr-2" />
            Quarterly/Annual View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="priorities">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {categories.map((category) => (
              <div key={category.key}>
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  {category.label}
                  <Badge variant={category.color as any}>
                    {priorities.filter((p) => p.category === category.key).length}
                  </Badge>
                </h2>
                <div className="space-y-3">
                  {priorities
                    .filter((p) => p.category === category.key)
                    .map((priority) => (
                      <Card
                        key={priority.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => openEditDialog(priority)}
                        data-testid={`priority-card-${priority.id}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            <GripVertical className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <CardTitle className="text-base">{priority.title}</CardTitle>
                              {priority.linkedGoals.length > 0 && (
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Link2 className="h-3 w-3 text-muted-foreground" />
                                  {priority.linkedGoals.map((goal, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      <Target className="h-3 w-3 mr-1" />
                                      {goal}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            {priority.description}
                          </p>
                          {priority.comments && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <p className="text-xs text-muted-foreground">
                                  {priority.comments}
                                </p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  {priorities.filter((p) => p.category === category.key).length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center text-sm text-muted-foreground">
                        No priorities in this category
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Strategic Timeline</h2>
              <Badge variant="outline">{mockTimeline.length} periods</Badge>
            </div>
            <div className="space-y-6">
              {mockTimeline.map((entry, index) => (
                <Card key={index} data-testid={`timeline-entry-${index}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-xl">{entry.period}</CardTitle>
                        <CardDescription className="mt-1">
                          Updated by {entry.updatedBy} on {entry.updatedAt}
                        </CardDescription>
                      </div>
                      <Badge variant={index === 0 ? "default" : "secondary"}>
                        {index === 0 ? "Current" : "Archive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {entry.notes && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm font-medium mb-1">Period Notes:</p>
                        <p className="text-sm text-muted-foreground">{entry.notes}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium mb-3">
                        Strategic Priorities ({entry.priorities.length}):
                      </p>
                      <div className="space-y-3">
                        {entry.priorities.map((priority) => (
                          <Card key={priority.id} className="bg-background">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <h4 className="font-semibold">{priority.title}</h4>
                                <Badge variant={
                                  priority.category === "critical" ? "destructive" :
                                  priority.category === "high" ? "default" :
                                  priority.category === "medium" ? "secondary" : "outline"
                                }>
                                  {priority.category}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {priority.description}
                              </p>
                              {priority.linkedGoals.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {priority.linkedGoals.map((goal, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      <Target className="h-3 w-3 mr-1" />
                                      {goal}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {priority.comments && (
                                <div className="mt-2 pt-2 border-t">
                                  <p className="text-xs text-muted-foreground">
                                    <MessageSquare className="h-3 w-3 inline mr-1" />
                                    {priority.comments}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Priority Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Strategic Priority</DialogTitle>
          </DialogHeader>
          {selectedPriority && (
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={selectedPriority.title}
                  onChange={(e) =>
                    setSelectedPriority({ ...selectedPriority, title: e.target.value })
                  }
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={selectedPriority.description}
                  onChange={(e) =>
                    setSelectedPriority({ ...selectedPriority, description: e.target.value })
                  }
                  rows={3}
                  data-testid="input-edit-description"
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={selectedPriority.category}
                  onValueChange={(value) =>
                    setSelectedPriority({
                      ...selectedPriority,
                      category: value as Priority["category"],
                    })
                  }
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="low">Low Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Linked Goals</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Connect this priority to strategic goals from Foundations
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableGoals.map((goal) => {
                    const isLinked = selectedPriority.linkedGoals.includes(goal);
                    return (
                      <Badge
                        key={goal}
                        variant={isLinked ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const updated = isLinked
                            ? selectedPriority.linkedGoals.filter((g) => g !== goal)
                            : [...selectedPriority.linkedGoals, goal];
                          setSelectedPriority({ ...selectedPriority, linkedGoals: updated });
                        }}
                        data-testid={`goal-badge-${goal}`}
                      >
                        <Target className="h-3 w-3 mr-1" />
                        {goal}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label htmlFor="edit-comments">Comments & Notes</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Add context, progress updates, or additional notes
                </p>
                <Textarea
                  id="edit-comments"
                  value={selectedPriority.comments}
                  onChange={(e) =>
                    setSelectedPriority({ ...selectedPriority, comments: e.target.value })
                  }
                  rows={4}
                  placeholder="Enter comments..."
                  data-testid="input-edit-comments"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    updatePriority(selectedPriority);
                    setEditDialogOpen(false);
                  }}
                  data-testid="button-update-priority"
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
