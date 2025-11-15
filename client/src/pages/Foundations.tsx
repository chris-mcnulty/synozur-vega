import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sparkles, ChevronRight, ChevronLeft } from "lucide-react";

const steps = ["Mission", "Vision", "Values", "Review"];

export default function Foundations() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    mission: "",
    vision: "",
    values: "",
  });

  const handleGenerate = (field: keyof typeof formData) => {
    const suggestions = {
      mission: "To empower organizations with AI-driven insights and tools that transform strategy into actionable results, fostering innovation and sustainable growth.",
      vision: "A world where every organization operates with clarity, purpose, and data-driven decision-making at its core.",
      values: "Innovation, Integrity, Collaboration, Excellence, Customer Success",
    };
    setFormData({ ...formData, [field]: suggestions[field] });
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Foundations</h1>
        <p className="text-muted-foreground">
          Define your organization's core purpose and values
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              {steps.map((step, index) => (
                <span
                  key={step}
                  className={`text-sm ${
                    index <= currentStep
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {step}
                </span>
              ))}
            </div>
            <Progress value={progress} data-testid="progress-wizard" />
          </div>
          <CardTitle>Step {currentStep + 1}: {steps[currentStep]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="mission">Mission Statement</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  What is your organization's fundamental purpose?
                </p>
                <Textarea
                  id="mission"
                  value={formData.mission}
                  onChange={(e) =>
                    setFormData({ ...formData, mission: e.target.value })
                  }
                  placeholder="Enter your mission statement..."
                  rows={4}
                  data-testid="input-mission"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleGenerate("mission")}
                data-testid="button-generate-mission"
              >
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </Button>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="vision">Vision Statement</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  What future do you aspire to create?
                </p>
                <Textarea
                  id="vision"
                  value={formData.vision}
                  onChange={(e) =>
                    setFormData({ ...formData, vision: e.target.value })
                  }
                  placeholder="Enter your vision statement..."
                  rows={4}
                  data-testid="input-vision"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleGenerate("vision")}
                data-testid="button-generate-vision"
              >
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="values">Core Values</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  What principles guide your organization?
                </p>
                <Textarea
                  id="values"
                  value={formData.values}
                  onChange={(e) =>
                    setFormData({ ...formData, values: e.target.value })
                  }
                  placeholder="Enter your core values..."
                  rows={4}
                  data-testid="input-values"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleGenerate("values")}
                data-testid="button-generate-values"
              >
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Mission</h3>
                <p className="text-muted-foreground">{formData.mission || "Not set"}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Vision</h3>
                <p className="text-muted-foreground">{formData.vision || "Not set"}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Values</h3>
                <p className="text-muted-foreground">{formData.values || "Not set"}</p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              data-testid="button-previous"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={() =>
                setCurrentStep(Math.min(steps.length - 1, currentStep + 1))
              }
              disabled={currentStep === steps.length - 1}
              data-testid="button-next"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
