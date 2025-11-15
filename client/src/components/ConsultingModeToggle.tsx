import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, User } from "lucide-react";

export function ConsultingModeToggle() {
  const [isConsultantMode, setIsConsultantMode] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">Mode:</span>
      <Button
        variant={isConsultantMode ? "default" : "outline"}
        size="sm"
        onClick={() => setIsConsultantMode(!isConsultantMode)}
        className="gap-2"
        data-testid="button-toggle-consulting-mode"
      >
        {isConsultantMode ? (
          <>
            <Users className="h-4 w-4" />
            Consultant-led
          </>
        ) : (
          <>
            <User className="h-4 w-4" />
            Self-Service
          </>
        )}
      </Button>
      {isConsultantMode && (
        <Badge variant="secondary" data-testid="badge-consultant-mode">
          Guided Support Active
        </Badge>
      )}
    </div>
  );
}
