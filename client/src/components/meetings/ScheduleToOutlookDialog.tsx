import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Meeting } from "@shared/schema";

interface SuggestedTimeSlot {
  start: string;
  end: string;
  freeCount: number;
  totalAttendees: number;
}

interface ScheduleToOutlookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting;
  onConfirm: (startDateTime: string, durationMinutes: number) => void;
  isSyncing?: boolean;
}

export function ScheduleToOutlookDialog({ open, onOpenChange, meeting, onConfirm, isSyncing }: ScheduleToOutlookDialogProps) {
  const { toast } = useToast();
  const attendeeEmails = (meeting.attendees || []).filter(a => a.includes('@'));
  const hasAttendees = attendeeEmails.length > 0;

  const [step, setStep] = useState<'suggestions' | 'manual'>('suggestions');
  const [suggestions, setSuggestions] = useState<SuggestedTimeSlot[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SuggestedTimeSlot | null>(null);
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState((meeting as any).duration || 60);

  useEffect(() => {
    if (open) {
      setSelectedSlot(null);
      setSuggestions([]);
      setFetchError(null);
      if (hasAttendees) {
        setStep('suggestions');
        doFetchSuggestions(durationMinutes);
      } else {
        setStep('manual');
      }
    }
  }, [open]);

  function handleDurationChange(newDuration: number) {
    setDurationMinutes(newDuration);
    if (step === 'suggestions' && hasAttendees) {
      setSelectedSlot(null);
      setSuggestions([]);
      setFetchError(null);
      doFetchSuggestions(newDuration);
    }
  }

  async function doFetchSuggestions(duration: number) {
    setIsFetching(true);
    setFetchError(null);
    try {
      const res = await apiRequest('POST', '/api/m365/suggest-times', {
        attendeeEmails,
        durationMinutes: duration,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch suggestions');
      setSuggestions(data.suggestions || []);
      if ((data.suggestions || []).length === 0) {
        setFetchError('No available time slots found in the next 7 days. Please select a time manually.');
      }
    } catch (err: any) {
      setFetchError(err.message || 'Could not fetch availability. Please select a time manually.');
      setSuggestions([]);
    } finally {
      setIsFetching(false);
    }
  }

  function handleConfirmSuggestion() {
    if (!selectedSlot) return;
    onConfirm(selectedSlot.start, durationMinutes);
    onOpenChange(false);
  }

  function handleConfirmManual() {
    if (!manualDate) {
      toast({ title: 'Date required', description: 'Please select a date.', variant: 'destructive' });
      return;
    }
    const localDate = new Date(`${manualDate}T${manualTime}:00`);
    if (isNaN(localDate.getTime())) {
      toast({ title: 'Invalid date', description: 'Please enter a valid date and time.', variant: 'destructive' });
      return;
    }
    onConfirm(localDate.toISOString(), durationMinutes);
    onOpenChange(false);
  }

  function formatSlotDate(iso: string) {
    try { return format(new Date(iso), "EEEE, MMM d 'at' h:mm a"); } catch { return iso; }
  }

  function availabilityLabel(slot: SuggestedTimeSlot) {
    if (slot.totalAttendees === 0) return 'No attendees';
    if (slot.freeCount === slot.totalAttendees) return `All ${slot.totalAttendees} attendee${slot.totalAttendees > 1 ? 's' : ''} free`;
    return `${slot.freeCount} of ${slot.totalAttendees} attendees free`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" />
            Schedule to Outlook
          </DialogTitle>
          <DialogDescription>
            {step === 'suggestions'
              ? `Finding the best time for ${attendeeEmails.length} attendee${attendeeEmails.length > 1 ? 's' : ''}`
              : 'Choose a date and time for the meeting'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Label htmlFor="duration-select" className="shrink-0">Duration</Label>
            <Select value={String(durationMinutes)} onValueChange={(v) => handleDurationChange(Number(v))}>
              <SelectTrigger id="duration-select" className="w-40" data-testid="select-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
            {hasAttendees && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(step === 'suggestions' ? 'manual' : 'suggestions')}
                data-testid="button-toggle-schedule-mode"
              >
                {step === 'suggestions' ? 'Pick manually' : 'Show suggestions'}
              </Button>
            )}
          </div>

          {step === 'suggestions' && (
            <div className="space-y-2">
              {isFetching && (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Checking availability...</span>
                </div>
              )}
              {!isFetching && fetchError && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  {fetchError}
                  <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setStep('manual')} data-testid="button-fallback-manual">
                    Select time manually
                  </Button>
                </div>
              )}
              {!isFetching && !fetchError && suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground mb-2">Select a suggested time slot:</p>
                  {suggestions.map((slot, i) => {
                    const isSelected = selectedSlot?.start === slot.start;
                    const allFree = slot.freeCount === slot.totalAttendees;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        data-testid={`slot-suggestion-${i}`}
                        className={`w-full rounded-md border px-4 py-3 text-left transition-colors hover-elevate ${
                          isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{formatSlotDate(slot.start)}</span>
                          <Badge
                            variant={allFree ? 'default' : 'outline'}
                            className={`text-xs shrink-0 ${allFree ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' : ''}`}
                          >
                            {availabilityLabel(slot)}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 'manual' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="manual-date">Date</Label>
                  <Input id="manual-date" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} data-testid="input-manual-date" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-time">Time</Label>
                  <Input id="manual-time" type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} data-testid="input-manual-time" />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {step === 'suggestions' && !isFetching && (
            <Button onClick={handleConfirmSuggestion} disabled={!selectedSlot || isSyncing} data-testid="button-confirm-suggestion">
              {isSyncing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Scheduling...</> : <><CalendarCheck className="w-4 h-4 mr-1" />Schedule</>}
            </Button>
          )}
          {step === 'manual' && (
            <Button onClick={handleConfirmManual} disabled={isSyncing} data-testid="button-confirm-manual">
              {isSyncing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Scheduling...</> : <><CalendarCheck className="w-4 h-4 mr-1" />Schedule</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
