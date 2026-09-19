"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiIconPicker } from "@/components/shared/emoji-icon-picker";
import { useUpdateGroup } from "@/hooks/use-groups";
import { GROUP_ICONS } from "@/lib/validations/group";

interface EditGroupDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  initialIcon: string;
}

export function EditGroupDialog({
  groupId,
  open,
  onOpenChange,
  initialName,
  initialIcon,
}: EditGroupDialogProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const updateGroup = useUpdateGroup(groupId);

  // Deliberate: reset the form to match the group's current name/icon each
  // time the dialog opens.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(initialName);
      setIcon(initialIcon);
    }
  }, [open, initialName, initialIcon]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateGroup.mutateAsync({ name, icon });
      toast.success("Group updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update group");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
          <DialogDescription>Update the group name or icon.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-group-name">Group name</Label>
            <Input id="edit-group-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Icon</Label>
            <EmojiIconPicker icons={GROUP_ICONS} value={icon} onChange={setIcon} label="Group icon" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateGroup.isPending || !name.trim()}>
              {updateGroup.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
