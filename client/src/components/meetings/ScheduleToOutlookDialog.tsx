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
import { CalendarCheck, Loader2, Pencil } from "lucide-react";
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
  onConfirm: (startDateTime: string, durationMinutes: number, meetingTime: string) => void;
  isSyncing?: boolean;
}

function tomorrowNineAMLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function dateToLocalInputValue(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

export function ScheduleToOutlookDialog({ open, onOpenChange, meeting, onConfirm, isSyncing }: ScheduleToOutlookDialogProps) {
  const { toast } = useToast();
  const attendeeEmails = (meeting.attendees || []).filter(a => a.includes("@"));
  const hasAttendees = attendeeEmails.length > 0;

  const [suggestions, setSuggestions] = useState<SuggestedTimeSlot[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SuggestedTimeSlot | null>(null);
  const [showManual, setShowManual] = useState(false);

  const tomorrow9am = dateToLocalInputValue(tomorrowNineAMLocal());
  const [manualDate, setManualDate] = useState(tomorrow9am.date);
  const [manualTime, setManualTime] = useState(tomorrow9am.time);
  const [durationMinutes, setDurationMinutes] = useState((meeting as any).duration || 60);

  useEffect(() => {
    if (open) {
      setSelectedSlot(null);
      setSuggestions([]);
      setFetchError(null);
      setShowManual(false);
      const def = dateToLocalInputValue(tomorrowNineAMLocal());
      setManualDate(def.date);
      setManualTime(def.time);
      if (hasAttendees) {
        doFetchSuggestions(durationMinutes);
      } else {
        setShowManual(true);
      }
    }
  }, [open]);

  function handleDurationChange(newDuration: number) {
    setDurationMinutes(newDuration);
    if (hasAttendees && !showManual) {
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
      const res = await apiRequest("POST", "/api/m365/suggest-times", {
        attendeeEmails,
        durationMinutes: duration,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        windowStartDate: tomorrowNineAMLocal(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch suggestions");
      const slots: SuggestedTimeSlot[] = data.suggestions || [];
      // noData: Graph returned empty scheduleItems for all attendees — no calendar access.
      if (data.noData) {
        setSuggestions([]);
        setFetchError("Availability data isn't accessible for these attendees (likely a different Microsoft tenant). Please pick a time manually.");
        setShowManual(true);
        return;
      }
      setSuggestions(slots);
      if (slots.length > 0) {
        setSelectedSlot(slots[0]);
        const first = dateToLocalInputValue(slots[0].start);
        setManualDate(first.date);
        setManualTime(first.time);
      } else {
        setFetchError("No available time slots found. Please choose a time manually.");
        setShowManual(true);
      }
    } catch (err: any) {
      setFetchError(err.message || "Could not check availability. Please choose a time manually.");
      setSuggestions([]);
      setShowManual(true);
    } finally {
      setIsFetching(false);
    }
  }

  function handleSlotClick(slot: SuggestedTimeSlot) {
    setSelectedSlot(slot);
    const { date, time } = dateToLocalInputValue(slot.start);
    setManualDate(date);
    setManualTime(time);
  }

  function handleConfirm() {
    if (showManual || suggestions.length === 0) {
      if (!manualDate) {
        toast({ title: "Date required", description: "Please select a date.", variant: "destructive" });
        return;
      }
      const localDate = new Date(`${manualDate}T${manualTime}:00`);
      if (isNaN(localDate.getTime())) {
        toast({ title: "Invalid date", description: "Please enter a valid date and time.", variant: "destructive" });
        return;
      }
      // manualTime is already "HH:mm" local — pass it directly for DB storage.
      onConfirm(localDate.toISOString(), durationMinutes, manualTime);
    } else {
      if (!selectedSlot) return;
      // Extract local "HH:mm" from the slot's ISO start time so the DB gets the local time string.
      const localTime = dateToLocalInputValue(selectedSlot.start).time;
      onConfirm(selectedSlot.start, durationMinutes, localTime);
    }
    onOpenChange(false);
  }

  function formatSlotDate(iso: string) {
    try { return format(new Date(iso), "EEEE, MMM d 'at' h:mm a"); } catch { return iso; }
  }

  function availabilityLabel(slot: SuggestedTimeSlot) {
    if (slot.totalAttendees === 0) return "No attendee data";
    if (slot.freeCount === slot.totalAttendees) return `All ${slot.totalAttendees} free`;
    return `${slot.freeCount}/${slot.totalAttendees} free`;
  }

  const canConfirm = showManual || suggestions.length === 0
    ? !!manualDate
    : !!selectedSlot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" />
            Schedule to Outlook
          </DialogTitle>
          <DialogDescription>
            {hasAttendees && !showManual
              ? `Suggested times when all ${attendeeEmails.length} attendee${attendeeEmails.length > 1 ? "s" : ""} are free`
              : "Choose a date and time for this meeting"}
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
          </div>

          {hasAttendees && !showManual && (
            <div className="space-y-2">
              {isFetching && (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Checking availability for attendees...</span>
                </div>
              )}
              {!isFetching && fetchError && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  {fetchError}
                </div>
              )}
              {!isFetching && !fetchError && suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Select a time slot — first option is pre-selected:</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowManual(true)}
                      data-testid="button-toggle-schedule-mode"
                      className="text-xs h-7 px-2"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Pick different time
                    </Button>
                  </div>
                  {suggestions.map((slot, i) => {
                    const isSelected = selectedSlot?.start === slot.start;
                    const allFree = slot.freeCount === slot.totalAttendees && slot.totalAttendees > 0;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSlotClick(slot)}
                        data-testid={`slot-suggestion-${i}`}
                        className={`w-full rounded-md border px-4 py-3 text-left transition-colors hover-elevate ${
                          isSelected ? "border-primary bg-primary/10" : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{formatSlotDate(slot.start)}</span>
                          <Badge
                            variant={allFree ? "default" : "outline"}
                            className={`text-xs shrink-0 ${allFree ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" : ""}`}
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

          {(showManual || !hasAttendees || suggestions.length === 0) && !isFetching && (
            <div className="space-y-3">
              {hasAttendees && showManual && suggestions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManual(false)}
                  data-testid="button-show-suggestions"
                  className="text-xs h-7 px-2"
                >
                  Show suggested times
                </Button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="manual-date">Date</Label>
                  <Input
                    id="manual-date"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    data-testid="input-manual-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-time">Time</Label>
                  <Input
                    id="manual-time"
                    type="time"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    data-testid="input-manual-time"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isSyncing || isFetching}
            data-testid="button-confirm-schedule"
          >
            {isSyncing
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Scheduling...</>
              : <><CalendarCheck className="w-4 h-4 mr-1" />Schedule</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
