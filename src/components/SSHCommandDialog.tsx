import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SSHCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceName: string;
  publicIp: string;
  keyName: string;
  sshUser: string;
}

export const SSHCommandDialog = ({ open, onOpenChange, instanceName, publicIp, keyName, sshUser }: SSHCommandDialogProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const sshCommand = `ssh -i "${keyName}.pem" ${sshUser}@${publicIp}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sshCommand);
      setCopied(true);
      toast({ title: "Copied!", description: "SSH command copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Please select and copy manually." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Connect via SSH
          </DialogTitle>
          <DialogDescription>
            Run this command in your terminal to connect to <strong>{instanceName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <pre className="bg-muted rounded-lg p-4 pr-12 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all border">
              {sshCommand}
            </pre>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Make sure the <code className="bg-muted px-1 rounded">{keyName}.pem</code> file has the correct permissions:</p>
            <pre className="bg-muted rounded p-2 font-mono">chmod 400 {keyName}.pem</pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
