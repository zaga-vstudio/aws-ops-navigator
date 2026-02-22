import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  groupName: z
    .string()
    .min(1, "Group name is required")
    .max(255, "Group name must be under 255 characters")
    .regex(/^[a-zA-Z0-9_\-\s]+$/, "Only alphanumeric, hyphens, underscores and spaces allowed"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(255, "Description must be under 255 characters"),
  vpcId: z.string().min(1, "VPC is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface VPC {
  id: string;
  name: string;
}

interface CreateSecurityGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vpcs: VPC[];
  onSuccess: () => void;
}

export function CreateSecurityGroupDialog({ open, onOpenChange, vpcs, onSuccess }: CreateSecurityGroupDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { groupName: "", description: "", vpcId: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-security-group", {
        body: values,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Security Group Created", description: data.message });
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Security Group</DialogTitle>
          <DialogDescription>Create a new EC2 security group in your AWS account.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="groupName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input placeholder="my-security-group" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Security group for..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vpcId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>VPC</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a VPC" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vpcs.map((vpc) => (
                        <SelectItem key={vpc.id} value={vpc.id}>
                          {vpc.name ? `${vpc.name} (${vpc.id})` : vpc.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
