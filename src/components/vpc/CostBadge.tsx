import { Badge } from "@/components/ui/badge";
import { DollarSign, CheckCircle } from "lucide-react";

interface CostBadgeProps {
  type: 'free' | 'paid';
  label?: string;
}

export function CostBadge({ type, label }: CostBadgeProps) {
  if (type === 'free') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 gap-1">
        <CheckCircle className="h-3 w-3" />
        {label || 'Free Analysis'}
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20 gap-1">
      <DollarSign className="h-3 w-3" />
      {label || 'Paid Feature'}
    </Badge>
  );
}
