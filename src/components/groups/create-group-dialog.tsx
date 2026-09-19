"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiIconPicker } from "@/components/shared/emoji-icon-picker";
import { useCreateGroup } from "@/hooks/use-groups";
import { GROUP_ICONS } from "@/lib/validations/group";

export function CreateGroupDialog({ trigger }: { trigger: React.ReactElement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("👥");
  const createGroup = useCreateGroup();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const group = await createGroup.mutateAsync({ name, icon });
      toast.success("Group created");
      setOpen(false);
      setName("");
      setIcon("👥");
      router.push(`/groups/${group.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>Track shared expenses with friends, roommates, or a trip.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              required
              placeholder="Goa Trip"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Icon</Label>
            <EmojiIconPicker icons={GROUP_ICONS} value={icon} onChange={setIcon} label="Group icon" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createGroup.isPending || !name.trim()}>
              {createGroup.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
