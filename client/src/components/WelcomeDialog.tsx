import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, Building2, Target, Compass, Sparkles, ArrowRight, Upload } from "lucide-react";
import { Link, useLocation } from "wouter";

const WELCOME_DISMISSED_KEY = "vega-welcome-dismissed";

interface WelcomeDialogProps {
  isNewUser?: boolean;
}

export function WelcomeDialog({ isNewUser = false }: WelcomeDialogProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY);
    if (!dismissed && isNewUser) {
      setOpen(true);
    }
  }, [isNewUser]);

  const handleDismiss = () => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    setOpen(false);
  };

  const handleGoToLaunchpad = () => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    setOpen(false);
    setLocation("/launchpad");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleDismiss();
      setOpen(isOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-welcome">
        <DialogHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl" data-testid="text-welcome-title">
            Welcome to Vega!
          </DialogTitle>
          <DialogDescription className="text-base pt-2" data-testid="text-welcome-description">
            Thank you for signing up. Vega is your Company Operating System &mdash; 
            a single place to align strategy with execution.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Feel free to explore these core modules:
          </p>
          
          <div className="grid grid-cols-3 gap-3">
            <Card className="hover-elevate cursor-pointer" data-testid="card-explore-foundations">
              <Link href="/foundations">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <Building2 className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Foundations</span>
                  <span className="text-xs text-muted-foreground">Mission, Vision, Values</span>
                </CardContent>
              </Link>
            </Card>
            
            <Card className="hover-elevate cursor-pointer" data-testid="card-explore-strategies">
              <Link href="/strategies">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <Compass className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Strategies</span>
                  <span className="text-xs text-muted-foreground">Strategic initiatives</span>
                </CardContent>
              </Link>
            </Card>
            
            <Card className="hover-elevate cursor-pointer" data-testid="card-explore-outcomes">
              <Link href="/planning">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <Target className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Outcomes</span>
                  <span className="text-xs text-muted-foreground">OKRs & Big Rocks</span>
                </CardContent>
              </Link>
            </Card>
          </div>

          <Card className="bg-primary/5 border-primary/20" data-testid="card-launchpad-cta">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">Quick Start with Launchpad</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Have a business plan, strategy deck, or annual goals document? 
                    Upload it to <strong>Launchpad</strong> and we'll use AI to create 
                    an initial Company OS for you to tailor.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    <span>Supports PDF, Word, Excel, and PowerPoint files</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button 
            variant="outline" 
            onClick={handleDismiss}
            data-testid="button-explore-myself"
          >
            I'll explore myself
          </Button>
          <Button 
            onClick={handleGoToLaunchpad}
            className="gap-2"
            data-testid="button-go-to-launchpad"
          >
            <Rocket className="h-4 w-4" />
            Go to Launchpad
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
