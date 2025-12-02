import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Cloud, Eye, EyeOff } from "lucide-react";

interface AWSCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "update" | "test";
}

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" }
];

export function AWSCredentialsDialog({ open, onOpenChange, mode }: AWSCredentialsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [formData, setFormData] = useState({
    accessKeyId: "",
    secretAccessKey: "",
    region: "us-east-1"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke('save-aws-credentials', {
        body: {
          accessKeyId: formData.accessKeyId,
          secretAccessKey: formData.secretAccessKey,
          region: formData.region
        }
      });

      if (error) throw error;

      if (mode === "update") {
        toast.success("AWS credentials updated successfully");
      } else {
        toast.success("AWS connection test successful");
      }

      setFormData({
        accessKeyId: "",
        secretAccessKey: "",
        region: "us-east-1"
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving AWS credentials:", error);

      // Extract the most useful message from the edge function
      const rawMessage =
        (error?.context as any)?.error ??
        error?.message ??
        (typeof error === "string" ? error : "");

      const message = (rawMessage || "").toString();

      if (message.includes("InvalidClientTokenId")) {
        toast.error("Your AWS Access Key ID is invalid. Please check and try again.");
      } else if (message.includes("SignatureDoesNotMatch")) {
        toast.error("Your AWS Secret Access Key is invalid. Please re-enter it carefully.");
      } else if (message.includes("Failed to encrypt credentials")) {
        toast.error("Could not save your AWS credentials securely. Please try again in a few minutes.");
      } else if (message.includes("AWS credentials not configured")) {
        toast.error("Your AWS credentials are not configured yet. Please enter them and save.");
      } else {
        toast.error("Could not save your AWS credentials. Please verify the data and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            {mode === "update" ? "Update AWS Credentials" : "Test AWS Connection"}
          </DialogTitle>
          <DialogDescription>
            {mode === "update" 
              ? "Enter your new AWS credentials. They will be encrypted and stored securely." 
              : "Enter your AWS credentials to test the connection."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accessKeyId">AWS Access Key ID</Label>
            <div className="relative">
              <Input
                id="accessKeyId"
                type={showAccessKey ? "text" : "password"}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                value={formData.accessKeyId}
                onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
                required
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowAccessKey(!showAccessKey)}
              >
                {showAccessKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secretAccessKey">AWS Secret Access Key</Label>
            <div className="relative">
              <Input
                id="secretAccessKey"
                type={showSecretKey ? "text" : "password"}
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                value={formData.secretAccessKey}
                onChange={(e) => setFormData({ ...formData, secretAccessKey: e.target.value })}
                required
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">AWS Region</Label>
            <Select value={formData.region} onValueChange={(value) => setFormData({ ...formData, region: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AWS_REGIONS.map((region) => (
                  <SelectItem key={region.value} value={region.value}>
                    {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : mode === "update" ? "Update Credentials" : "Test Connection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
