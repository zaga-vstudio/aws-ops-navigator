import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ManageIAMUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
  onSuccess: () => void;
}

export function ManageIAMUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: ManageIAMUserDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'create' | 'delete' | 'rotate_key' | 'disable_key'>('create');
  const [userName, setUserName] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('manage-iam-users', {
        body: {
          action,
          userName: userName || user?.userName,
          accessKeyId: accessKeyId || undefined,
          reason
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Success",
        description: `IAM ${action} completed successfully`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error managing IAM user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to manage IAM user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage IAM User</DialogTitle>
          <DialogDescription>
            Create, delete, or manage access keys for IAM users
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Warning: IAM operations can affect access to your AWS resources. 
            Make sure you understand the implications before proceeding.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="action">Action</Label>
            <Select value={action} onValueChange={(value: any) => setAction(value)}>
              <SelectTrigger id="action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">Create New User</SelectItem>
                <SelectItem value="delete">Delete User</SelectItem>
                <SelectItem value="rotate_key">Rotate Access Key</SelectItem>
                <SelectItem value="disable_key">Disable Access Key</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(action === 'create' || action === 'delete') && (
            <div className="space-y-2">
              <Label htmlFor="userName">Username *</Label>
              <Input
                id="userName"
                placeholder="Enter IAM username"
                value={userName || user?.userName || ''}
                onChange={(e) => setUserName(e.target.value)}
                required
              />
            </div>
          )}

          {user && (action === 'rotate_key' || action === 'disable_key') && (
            <>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={user.userName} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessKeyId">Access Key ID *</Label>
                <Input
                  id="accessKeyId"
                  placeholder="AKIA..."
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Enter the Access Key ID you want to {action === 'rotate_key' ? 'rotate' : 'disable'}
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change *</Label>
            <Textarea
              id="reason"
              placeholder="Explain why this change is needed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
            />
          </div>

          {action === 'delete' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Deleting a user will remove all their access keys and permissions. This action cannot be undone.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              variant={action === 'delete' ? 'destructive' : 'default'}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === 'create' && 'Create User'}
              {action === 'delete' && 'Delete User'}
              {action === 'rotate_key' && 'Rotate Key'}
              {action === 'disable_key' && 'Disable Key'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
