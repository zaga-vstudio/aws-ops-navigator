import { Badge } from "@/components/ui/badge";
import { DollarSign, CheckCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CostBadgeProps {
  type: 'free' | 'paid';
  label?: string;
  costNote?: string;
}

export function CostBadge({ type, label, costNote }: CostBadgeProps) {
  const badge = type === 'free' ? (
    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 gap-1">
      <CheckCircle className="h-3 w-3" />
      {label || 'Free Tier'}
    </Badge>
  ) : (
    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20 gap-1">
      <DollarSign className="h-3 w-3" />
      {label || 'Paid'}
    </Badge>
  );

  if (costNote) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-[250px]">{costNote}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
