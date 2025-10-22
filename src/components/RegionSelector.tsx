import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Region {
  code: string;
  name: string;
  location: string;
}

const AWS_REGIONS: Region[] = [
  { code: "us-east-1", name: "US East", location: "N. Virginia" },
  { code: "us-east-2", name: "US East", location: "Ohio" },
  { code: "us-west-1", name: "US West", location: "N. California" },
  { code: "us-west-2", name: "US West", location: "Oregon" },
  { code: "af-south-1", name: "Africa", location: "Cape Town" },
  { code: "ap-east-1", name: "Asia Pacific", location: "Hong Kong" },
  { code: "ap-south-1", name: "Asia Pacific", location: "Mumbai" },
  { code: "ap-northeast-1", name: "Asia Pacific", location: "Tokyo" },
  { code: "ap-northeast-2", name: "Asia Pacific", location: "Seoul" },
  { code: "ap-northeast-3", name: "Asia Pacific", location: "Osaka" },
  { code: "ap-southeast-1", name: "Asia Pacific", location: "Singapore" },
  { code: "ap-southeast-2", name: "Asia Pacific", location: "Sydney" },
  { code: "ca-central-1", name: "Canada", location: "Central" },
  { code: "eu-central-1", name: "Europe", location: "Frankfurt" },
  { code: "eu-west-1", name: "Europe", location: "Ireland" },
  { code: "eu-west-2", name: "Europe", location: "London" },
  { code: "eu-west-3", name: "Europe", location: "Paris" },
  { code: "eu-south-1", name: "Europe", location: "Milan" },
  { code: "eu-north-1", name: "Europe", location: "Stockholm" },
  { code: "me-south-1", name: "Middle East", location: "Bahrain" },
  { code: "sa-east-1", name: "South America", location: "São Paulo" },
];

interface RegionSelectorProps {
  currentRegion: string;
  onRegionChange: (region: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegionSelector({
  currentRegion,
  onRegionChange,
  open,
  onOpenChange,
}: RegionSelectorProps) {
  const [selectedRegion, setSelectedRegion] = useState(currentRegion);

  const handleConfirm = () => {
    onRegionChange(selectedRegion);
    onOpenChange(false);
  };

  const currentRegionInfo = AWS_REGIONS.find(r => r.code === currentRegion);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Select AWS Region
          </DialogTitle>
          <DialogDescription>
            Choose the AWS region for your infrastructure. Current region: {currentRegionInfo?.location}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {AWS_REGIONS.map((region) => (
              <button
                key={region.code}
                onClick={() => setSelectedRegion(region.code)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                  selectedRegion === region.code
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {region.name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {region.code}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {region.location}
                  </span>
                </div>
                {selectedRegion === region.code && (
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm Region
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
