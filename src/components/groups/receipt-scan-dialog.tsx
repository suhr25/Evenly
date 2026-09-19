"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { Loader2, Plus, Receipt as ReceiptIcon, Trash2, Upload } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/hooks/use-categories";
import { splitByShares, toMoney } from "@/lib/money";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  useConfirmReceipt,
  useDiscardReceipt,
  useUploadReceipt,
  type ReceiptDTO,
  type ReceiptItemDTO,
} from "@/hooks/use-receipts";
import type { GroupMemberDTO } from "@/hooks/use-groups";

interface ReceiptScanDialogProps {
  groupId: string;
  members: GroupMemberDTO[];
  currency: string;
}

interface EditableItem extends ReceiptItemDTO {
  memberIds: string[];
}

export function ReceiptScanDialog({ groupId, members, currency }: ReceiptScanDialogProps) {
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDTO | null>(null);
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [items, setItems] = useState<EditableItem[]>([]);
  const [tax, setTax] = useState("");
  const [discount, setDiscount] = useState("");
  const [tip, setTip] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMembers = members.filter((m) => m.isActive);
  const { data: categories } = useCategories();
  const uploadReceipt = useUploadReceipt();
  const confirmReceipt = useConfirmReceipt(groupId);
  const discardReceipt = useDiscardReceipt();

  const itemsTotal = items.reduce((sum, i) => sum.plus(toMoney(i.totalPrice || "0")), toMoney(0));
  const grandTotal = itemsTotal
    .plus(toMoney(tax || "0"))
    .plus(toMoney(tip || "0"))
    .minus(toMoney(discount || "0"));

  function reset() {
    setReceipt(null);
    setMerchant("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setItems([]);
    setTax("");
    setDiscount("");
    setTip("");
    setCategoryId("");
    setPaidByMemberId("");
    setError(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadReceipt.mutateAsync(file);
      setReceipt(result);
      setMerchant(result.merchant ?? "");
      setDate(result.date ? result.date.slice(0, 10) : format(new Date(), "yyyy-MM-dd"));
      setItems(
        result.items.length
          ? result.items.map((i) => ({ ...i, memberIds: activeMembers.map((m) => m.id) }))
          : [{ name: "", quantity: "1", unitPrice: "", totalPrice: "", memberIds: activeMembers.map((m) => m.id) }]
      );
      setTax(result.tax ?? "");
      setDiscount(result.discount ?? "");
      setTip(result.tip ?? "");
      setPaidByMemberId(activeMembers.find((m) => m.isYou)?.id ?? activeMembers[0]?.id ?? "");
      if (result.extractionFailed) {
        toast.info("Couldn't read this automatically. Please fill in the details.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload receipt");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function toggleItemMember(index: number, memberId: string) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              memberIds: it.memberIds.includes(memberId)
                ? it.memberIds.filter((id) => id !== memberId)
                : [...it.memberIds, memberId],
            }
          : it
      )
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { name: "", quantity: "1", unitPrice: "", totalPrice: "", memberIds: activeMembers.map((m) => m.id) },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const memberPreview = (() => {
    const weights = new Map<string, number>();
    items.forEach((item) => {
      if (!item.memberIds.length || !Number(item.totalPrice)) return;
      const per = toMoney(item.totalPrice).dividedBy(item.memberIds.length).toNumber();
      item.memberIds.forEach((id) => weights.set(id, (weights.get(id) ?? 0) + per));
    });
    const entries = [...weights.entries()].filter(([, w]) => w > 0);
    if (entries.length === 0 || grandTotal.lessThanOrEqualTo(0)) return [];
    const amounts = splitByShares(
      grandTotal,
      entries.map(([, w]) => w)
    );
    return entries.map(([memberId], i) => ({
      memberId,
      name: activeMembers.find((m) => m.id === memberId)?.name ?? "?",
      amount: amounts[i],
    }));
  })();

  async function handleConfirm() {
    setError(null);
    if (!receipt) return;
    if (!categoryId) return setError("Choose a category.");
    if (!paidByMemberId) return setError("Choose who paid.");
    if (items.some((i) => !i.name.trim() || Number(i.totalPrice) <= 0)) {
      return setError("Every item needs a name and a price greater than 0.");
    }
    if (memberPreview.length === 0) {
      return setError("Assign at least one item to someone.");
    }

    try {
      await confirmReceipt.mutateAsync({
        receiptId: receipt.id,
        input: {
          groupId,
          categoryId,
          paidByMemberId,
          description: merchant.trim() || "Receipt",
          date,
          merchant: merchant.trim() || null,
          items: items.map((it) => ({
            name: it.name,
            quantity: it.quantity || "1",
            unitPrice: it.unitPrice || it.totalPrice,
            totalPrice: it.totalPrice,
          })),
          subtotal: itemsTotal.toString(),
          tax: tax || null,
          discount: discount || null,
          tip: tip || null,
          total: grandTotal.toString(),
          itemAssignments: items.map((it, itemIndex) => ({ itemIndex, memberIds: it.memberIds })),
        },
      });
      toast.success("Expense added from receipt");
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    }
  }

  async function handleCancel() {
    if (receipt) {
      discardReceipt.mutate(receipt.id);
    }
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleCancel();
        else setOpen(true);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <ReceiptIcon className="size-4" aria-hidden />
            Scan receipt
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Scan receipt</DialogTitle>
          <DialogDescription>
            {receipt
              ? "Review the extracted details, assign items, then confirm."
              : "Upload a photo of a bill or receipt to split it automatically."}
          </DialogDescription>
        </DialogHeader>

        {!receipt ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12">
            {uploadReceipt.isPending ? (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">Reading your receipt...</p>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground/50" aria-hidden />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Choose a photo
                </Button>
                <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP, up to 8MB</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
            <div className="flex gap-3">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-md border">
                <Image src={receipt.imageUrl} alt="Receipt" fill className="object-cover" unoptimized />
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rc-merchant">Merchant</Label>
                  <Input id="rc-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Receipt" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rc-date">Date</Label>
                  <Input id="rc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rc-category">Category</Label>
                <Select
                  items={Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]))}
                  value={categoryId}
                  onValueChange={(v) => v && setCategoryId(v)}
                >
                  <SelectTrigger id="rc-category" className="w-full">
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rc-paidby">Paid by</Label>
                <Select
                  items={Object.fromEntries(activeMembers.map((m) => [m.id, m.isYou ? `${m.name} (you)` : m.name]))}
                  value={paidByMemberId}
                  onValueChange={(v) => v && setPaidByMemberId(v)}
                >
                  <SelectTrigger id="rc-paidby" className="w-full">
                    <SelectValue placeholder="Who paid?" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.isYou ? `${m.name} (you)` : m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                  <Plus className="size-3.5" aria-hidden />
                  Add item
                </Button>
              </div>
              {items.map((item, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-md border p-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(index, { name: e.target.value })}
                      placeholder="Item name"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.totalPrice}
                      onChange={(e) => updateItem(index, { totalPrice: e.target.value })}
                      placeholder="Price"
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove item"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="size-4 text-destructive" aria-hidden />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleItemMember(index, m.id)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs transition-colors",
                          item.memberIds.includes(m.id)
                            ? "border-primary bg-accent"
                            : "text-muted-foreground"
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rc-tax">Tax</Label>
                <Input id="rc-tax" type="number" step="0.01" min="0" value={tax} onChange={(e) => setTax(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rc-discount">Discount</Label>
                <Input id="rc-discount" type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rc-tip">Tip</Label>
                <Input id="rc-tip" type="number" step="0.01" min="0" value={tip} onChange={(e) => setTip(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(grandTotal, currency)}</span>
            </div>

            {memberPreview.length > 0 && (
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                {memberPreview.map((p) => (
                  <div key={p.memberId} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="tabular-nums">{formatMoney(p.amount, currency)}</span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {receipt && (
            <Button type="button" onClick={handleConfirm} disabled={confirmReceipt.isPending}>
              {confirmReceipt.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Confirm and save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
