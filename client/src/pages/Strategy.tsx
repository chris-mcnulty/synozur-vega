import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Priority = {
  id: string;
  title: string;
  description: string;
  category: "critical" | "high" | "medium" | "low";
};

const mockPriorities: Priority[] = [
  {
    id: "1",
    title: "Launch New Product Line",
    description: "Develop and launch innovative AI-powered analytics suite",
    category: "critical",
  },
  {
    id: "2",
    title: "Expand Market Presence",
    description: "Enter three new geographic markets in EMEA region",
    category: "high",
  },
  {
    id: "3",
    title: "Improve Customer Retention",
    description: "Implement customer success program to reduce churn",
    category: "high",
  },
];

const categories = [
  { key: "critical", label: "Critical", color: "destructive" },
  { key: "high", label: "High Priority", color: "default" },
  { key: "medium", label: "Medium Priority", color: "secondary" },
  { key: "low", label: "Low Priority", color: "outline" },
] as const;

export default function Strategy() {
  const [priorities] = useState<Priority[]>(mockPriorities);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Strategy</h1>
          <p className="text-muted-foreground">
            Manage your strategic priorities and initiatives
          </p>
        </div>
        <div className="flex gap-2">
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
                <Button className="w-full" data-testid="button-save-priority">
                  Create Priority
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                    className="hover-elevate cursor-move"
                    data-testid={`priority-card-${priority.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <GripVertical className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <CardTitle className="text-base">{priority.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {priority.description}
                      </p>
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
    </div>
  );
}
