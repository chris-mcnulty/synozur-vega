import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sparkles, ExternalLink, Check } from "lucide-react";

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

export default function Foundations() {
  const [selectedMission, setSelectedMission] = useState<string[]>([]);
  const [selectedVision, setSelectedVision] = useState<string[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

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
    // Placeholder for Nebula integration
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Foundations</h1>
        <p className="text-muted-foreground">
          Define your organization's core purpose, values, and strategic goals
        </p>
      </div>

      {/* Mission Section */}
      <Card data-testid="card-mission">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle>Mission Statement</CardTitle>
              <CardDescription>
                What is your organization's fundamental purpose?
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openNebulaWorkspace("Mission")}
              data-testid="button-nebula-mission"
            >
              <Sparkles className="h-4 w-4" />
              Open in Nebula
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {missionOptions.map((option, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-all hover-elevate ${
                  selectedMission.includes(option)
                    ? "border-primary bg-primary/5"
                    : ""
                }`}
                onClick={() =>
                  toggleSelection(option, selectedMission, setSelectedMission)
                }
                data-testid={`option-mission-${index}`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selectedMission.includes(option)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {selectedMission.includes(option) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <p className="text-sm">{option}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {selectedMission.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Selected mission components:
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedMission.map((item, index) => (
                  <Badge key={index} variant="secondary" data-testid={`badge-mission-${index}`}>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vision Section */}
      <Card data-testid="card-vision">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle>Vision Statement</CardTitle>
              <CardDescription>
                What future do you aspire to create?
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openNebulaWorkspace("Vision")}
              data-testid="button-nebula-vision"
            >
              <Sparkles className="h-4 w-4" />
              Open in Nebula
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visionOptions.map((option, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-all hover-elevate ${
                  selectedVision.includes(option)
                    ? "border-primary bg-primary/5"
                    : ""
                }`}
                onClick={() =>
                  toggleSelection(option, selectedVision, setSelectedVision)
                }
                data-testid={`option-vision-${index}`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selectedVision.includes(option)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {selectedVision.includes(option) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <p className="text-sm">{option}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {selectedVision.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Selected vision components:
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedVision.map((item, index) => (
                  <Badge key={index} variant="secondary" data-testid={`badge-vision-${index}`}>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Values Section */}
      <Card data-testid="card-values">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle>Core Values</CardTitle>
              <CardDescription>
                What principles guide your organization? (Select multiple)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openNebulaWorkspace("Values")}
              data-testid="button-nebula-values"
            >
              <Sparkles className="h-4 w-4" />
              Open in Nebula
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {valueOptions.map((value, index) => (
              <Badge
                key={index}
                variant={selectedValues.includes(value) ? "default" : "outline"}
                className={`cursor-pointer py-2 px-4 text-sm ${
                  selectedValues.includes(value) ? "" : "hover-elevate"
                }`}
                onClick={() =>
                  toggleSelection(value, selectedValues, setSelectedValues)
                }
                data-testid={`option-value-${index}`}
              >
                {selectedValues.includes(value) && (
                  <Check className="h-3 w-3 mr-1" />
                )}
                {value}
              </Badge>
            ))}
          </div>
          {selectedValues.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm font-medium mb-3">
                {selectedValues.length} value{selectedValues.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedValues.map((item, index) => (
                  <Badge key={index} data-testid={`badge-selected-value-${index}`}>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goals Section */}
      <Card data-testid="card-goals">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle>Strategic Goals</CardTitle>
              <CardDescription>
                What are your key organizational objectives? (Select multiple)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openNebulaWorkspace("Goals")}
              data-testid="button-nebula-goals"
            >
              <Sparkles className="h-4 w-4" />
              Open in Nebula
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {goalOptions.map((goal, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-all hover-elevate ${
                  selectedGoals.includes(goal)
                    ? "border-primary bg-primary/5"
                    : ""
                }`}
                onClick={() =>
                  toggleSelection(goal, selectedGoals, setSelectedGoals)
                }
                data-testid={`option-goal-${index}`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selectedGoals.includes(goal)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {selectedGoals.includes(goal) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <p className="text-sm font-medium">{goal}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {selectedGoals.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-3">
                {selectedGoals.length} goal{selectedGoals.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedGoals.map((item, index) => (
                  <Badge key={index} variant="secondary" data-testid={`badge-goal-${index}`}>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <li key={index} className="text-sm">{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedVision.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Vision Components</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {selectedVision.map((item, index) => (
                    <li key={index} className="text-sm">{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedValues.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Core Values</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedValues.map((item, index) => (
                    <Badge key={index} variant="secondary">{item}</Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedGoals.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Strategic Goals</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {selectedGoals.map((item, index) => (
                    <li key={index} className="text-sm">{item}</li>
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
