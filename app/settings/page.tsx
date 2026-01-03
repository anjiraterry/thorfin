'use client'

import { useRouter } from "next/navigation";
import { ArrowLeft, Save, RotateCcw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Label } from "@/src/components/ui/label";
import { Input } from "@/src/components/ui/input";
import { Slider } from "@/src/components/ui/slider";
import { useToast } from "@/src/hooks/use-toast";
import { useAppStore } from "@/src/lib/store";
import { defaultSettings } from "@/types/@types";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { settings, setSettings, current_job_id } = useAppStore();

  const handleReset = () => {
    setSettings(defaultSettings);
    toast({
      title: "Settings reset",
      description: "All settings have been restored to defaults.",
    });
  };

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your settings have been saved successfully.",
    });
    if (current_job_id) {
      router.push("/results");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (current_job_id ? router.push("/results") : router.push("/"))}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-muted-foreground text-sm">
              Configure matching thresholds and processing options
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Matching Thresholds</CardTitle>
              <CardDescription>
                Adjust the tolerance levels for the matching engine
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount-tolerance">Amount Tolerance</Label>
                  <span className="font-mono text-sm">
                    {settings.amount_tolerance_cents} cents
                  </span>
                </div>
                <Slider
                  id="amount-tolerance"
                  min={0}
                  max={1000}
                  step={10}
                  value={[settings.amount_tolerance_cents]}
                  onValueChange={([value]: [number]) =>
                    setSettings({ amount_tolerance_cents: value })
                  }
                  data-testid="slider-amount-tolerance"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum difference in cents for amount matching (default: 100 cents / $1.00)
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="time-window">Time Window</Label>
                  <span className="font-mono text-sm">{settings.time_window_hours} hours</span>
                </div>
                <Slider
                  id="time-window"
                  min={1}
                  max={168}
                  step={1}
                  value={[settings.time_window_hours]}
                  onValueChange={([value]: [number]) => setSettings({ time_window_hours: value })}
                  data-testid="slider-time-window"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum time difference for timestamp matching (default: 48 hours)
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fuzzy-threshold">Fuzzy Match Threshold</Label>
                  <span className="font-mono text-sm">{settings.fuzzy_threshold}%</span>
                </div>
                <Slider
                  id="fuzzy-threshold"
                  min={50}
                  max={100}
                  step={1}
                  value={[settings.fuzzy_threshold]}
                  onValueChange={([value]: [number]) => setSettings({ fuzzy_threshold: value })}
                  data-testid="slider-fuzzy-threshold"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum similarity score for fuzzy reference matching (default: 85%)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Processing Limits</CardTitle>
              <CardDescription>
                Control resource usage and processing constraints
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="max-rows">Maximum Rows per File</Label>
                <Input
                  id="max-rows"
                  type="number"
                  min={100}
                  max={50000}
                  value={settings.max_rows}
                  onChange={(e) => setSettings({ max_rows: parseInt(e.target.value) || 10000 })}
                  data-testid="input-max-rows"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of rows to process per file (default: 10,000)
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="token-budget">LLM Token Budget</Label>
                <Input
                  id="token-budget"
                  type="number"
                  min={100}
                  max={10000}
                  value={settings.token_budget}
                  onChange={(e) => setSettings({ token_budget: parseInt(e.target.value) || 2000 })}
                  data-testid="input-token-budget"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum tokens to use for AI summaries per job (default: 2,000)
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button onClick={handleSave} data-testid="button-save">
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}