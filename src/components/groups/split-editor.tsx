"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatMoney, splitByPercentage, splitByShares, splitEqual, toMoney } from "@/lib/money";
import type { GroupMemberDTO } from "@/hooks/use-groups";

export type SplitState =
  | { splitType: "EQUAL"; memberIds: string[] }
  | { splitType: "EXACT"; amounts: Record<string, string> }
  | { splitType: "PERCENTAGE"; percentages: Record<string, string> }
  | { splitType: "SHARES"; units: Record<string, string> };

const SPLIT_TABS: { value: SplitState["splitType"]; label: string }[] = [
  { value: "EQUAL", label: "Equal" },
  { value: "EXACT", label: "Exact" },
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "SHARES", label: "Shares" },
];

interface SplitEditorProps {
  members: GroupMemberDTO[];
  amount: string;
  currency: string;
  value: SplitState;
  onChange: (value: SplitState) => void;
}

export function SplitEditor({ members, amount, currency, value, onChange }: SplitEditorProps) {
  const total = Number(amount) || 0;

  function switchType(splitType: SplitState["splitType"]) {
    if (splitType === "EQUAL") {
      onChange({ splitType, memberIds: members.map((m) => m.id) });
    } else if (splitType === "EXACT") {
      onChange({ splitType, amounts: Object.fromEntries(members.map((m) => [m.id, ""])) });
    } else if (splitType === "PERCENTAGE") {
      onChange({ splitType, percentages: Object.fromEntries(members.map((m) => [m.id, ""])) });
    } else {
      onChange({ splitType, units: Object.fromEntries(members.map((m) => [m.id, "1"])) });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={value.splitType} onValueChange={(v) => v && switchType(v as SplitState["splitType"])}>
        <TabsList className="w-full">
          {SPLIT_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-1">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {value.splitType === "EQUAL" && (
        <EqualSplit members={members} amount={total} currency={currency} value={value} onChange={onChange} />
      )}
      {value.splitType === "EXACT" && (
        <ExactSplit members={members} amount={total} currency={currency} value={value} onChange={onChange} />
      )}
      {value.splitType === "PERCENTAGE" && (
        <PercentageSplit members={members} amount={total} currency={currency} value={value} onChange={onChange} />
      )}
      {value.splitType === "SHARES" && (
        <SharesSplit members={members} amount={total} currency={currency} value={value} onChange={onChange} />
      )}
    </div>
  );
}

function MemberLabel({ member }: { member: GroupMemberDTO }) {
  return (
    <span className="flex-1 truncate text-sm">
      {member.name}
      {member.isYou && <span className="text-muted-foreground"> (you)</span>}
    </span>
  );
}

function SummaryLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={cn("text-xs font-medium", ok ? "text-positive" : "text-negative")}>
      {label}
    </p>
  );
}

function EqualSplit({
  members,
  amount,
  currency,
  value,
  onChange,
}: {
  members: GroupMemberDTO[];
  amount: number;
  currency: string;
  value: Extract<SplitState, { splitType: "EQUAL" }>;
  onChange: (v: SplitState) => void;
}) {
  const selected = value.memberIds;
  const shares = selected.length > 0 && amount > 0 ? splitEqual(amount, selected.length) : [];
  const amountByMember = new Map(selected.map((id, i) => [id, shares[i]]));

  return (
    <div className="flex flex-col gap-2">
      {members.map((m) => {
        const checked = selected.includes(m.id);
        return (
          <label key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Checkbox
              checked={checked}
              onCheckedChange={(c) =>
                onChange({
                  splitType: "EQUAL",
                  memberIds: c ? [...selected, m.id] : selected.filter((id) => id !== m.id),
                })
              }
            />
            <MemberLabel member={m} />
            {checked && amountByMember.get(m.id) && (
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatMoney(amountByMember.get(m.id)!, currency)}
              </span>
            )}
          </label>
        );
      })}
      <SummaryLine
        ok={selected.length > 0}
        label={selected.length > 0 ? `Split equally between ${selected.length} people` : "Select at least one person"}
      />
    </div>
  );
}

function ExactSplit({
  members,
  amount,
  currency,
  value,
  onChange,
}: {
  members: GroupMemberDTO[];
  amount: number;
  currency: string;
  value: Extract<SplitState, { splitType: "EXACT" }>;
  onChange: (v: SplitState) => void;
}) {
  const sum = Object.values(value.amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const remaining = toMoney(amount).minus(toMoney(sum)).toNumber();
  const balanced = Math.abs(remaining) < 0.005;

  return (
    <div className="flex flex-col gap-2">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
          <MemberLabel member={m} />
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="w-28"
            value={value.amounts[m.id] ?? ""}
            onChange={(e) => onChange({ splitType: "EXACT", amounts: { ...value.amounts, [m.id]: e.target.value } })}
          />
        </div>
      ))}
      <SummaryLine
        ok={balanced}
        label={
          balanced
            ? "Amounts match the total"
            : `${remaining > 0 ? "Remaining" : "Over by"} ${formatMoney(Math.abs(remaining), currency)}`
        }
      />
    </div>
  );
}

function PercentageSplit({
  members,
  amount,
  currency,
  value,
  onChange,
}: {
  members: GroupMemberDTO[];
  amount: number;
  currency: string;
  value: Extract<SplitState, { splitType: "PERCENTAGE" }>;
  onChange: (v: SplitState) => void;
}) {
  const pctValues = members.map((m) => Number(value.percentages[m.id]) || 0);
  const sum = pctValues.reduce((s, v) => s + v, 0);
  const balanced = Math.abs(sum - 100) < 0.01;
  let previewAmounts: string[] = [];
  if (balanced && amount > 0) {
    try {
      previewAmounts = splitByPercentage(amount, pctValues).map((d) => d.toString());
    } catch {
      previewAmounts = [];
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {members.map((m, i) => (
        <div key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
          <MemberLabel member={m} />
          {previewAmounts[i] && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatMoney(previewAmounts[i], currency)}
            </span>
          )}
          <div className="relative w-24">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              inputMode="decimal"
              className="pr-6"
              value={value.percentages[m.id] ?? ""}
              onChange={(e) =>
                onChange({ splitType: "PERCENTAGE", percentages: { ...value.percentages, [m.id]: e.target.value } })
              }
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
        </div>
      ))}
      <SummaryLine ok={balanced} label={balanced ? "Percentages add up to 100%" : `Total: ${sum.toFixed(2)}% (need 100%)`} />
    </div>
  );
}

function SharesSplit({
  members,
  amount,
  currency,
  value,
  onChange,
}: {
  members: GroupMemberDTO[];
  amount: number;
  currency: string;
  value: Extract<SplitState, { splitType: "SHARES" }>;
  onChange: (v: SplitState) => void;
}) {
  const unitValues = members.map((m) => Number(value.units[m.id]) || 0);
  const totalUnits = unitValues.reduce((s, v) => s + v, 0);
  let previewAmounts: string[] = [];
  if (totalUnits > 0 && amount > 0 && unitValues.every((u) => u >= 0)) {
    try {
      previewAmounts = splitByShares(amount, unitValues.map((u) => u || 0.0001)).map((d) => d.toString());
    } catch {
      previewAmounts = [];
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {members.map((m, i) => (
        <div key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
          <MemberLabel member={m} />
          {previewAmounts[i] && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatMoney(previewAmounts[i], currency)}
            </span>
          )}
          <Input
            type="number"
            step="1"
            min="0"
            className="w-20"
            value={value.units[m.id] ?? ""}
            onChange={(e) => onChange({ splitType: "SHARES", units: { ...value.units, [m.id]: e.target.value } })}
          />
        </div>
      ))}
      <SummaryLine ok={totalUnits > 0} label={totalUnits > 0 ? `${totalUnits} total shares` : "Enter at least one share"} />
    </div>
  );
}

export function buildSplitPayload(
  value: SplitState
): { splitType: "EQUAL"; memberIds: string[] }
  | { splitType: "EXACT"; shares: { memberId: string; amount: string }[] }
  | { splitType: "PERCENTAGE"; shares: { memberId: string; percentage: number }[] }
  | { splitType: "SHARES"; shares: { memberId: string; units: number }[] } {
  if (value.splitType === "EQUAL") {
    return { splitType: "EQUAL", memberIds: value.memberIds };
  }
  if (value.splitType === "EXACT") {
    return {
      splitType: "EXACT",
      shares: Object.entries(value.amounts)
        .filter(([, v]) => Number(v) > 0)
        .map(([memberId, v]) => ({ memberId, amount: v })),
    };
  }
  if (value.splitType === "PERCENTAGE") {
    return {
      splitType: "PERCENTAGE",
      shares: Object.entries(value.percentages)
        .filter(([, v]) => Number(v) > 0)
        .map(([memberId, v]) => ({ memberId, percentage: Number(v) })),
    };
  }
  return {
    splitType: "SHARES",
    shares: Object.entries(value.units)
      .filter(([, v]) => Number(v) > 0)
      .map(([memberId, v]) => ({ memberId, units: Number(v) })),
  };
}

export function isSplitValid(value: SplitState, amount: number): boolean {
  if (value.splitType === "EQUAL") return value.memberIds.length > 0;
  if (value.splitType === "EXACT") {
    const sum = Object.values(value.amounts).reduce((s, v) => s + (Number(v) || 0), 0);
    return Math.abs(sum - amount) < 0.005;
  }
  if (value.splitType === "PERCENTAGE") {
    const sum = Object.values(value.percentages).reduce((s, v) => s + (Number(v) || 0), 0);
    return Math.abs(sum - 100) < 0.01;
  }
  const sum = Object.values(value.units).reduce((s, v) => s + (Number(v) || 0), 0);
  return sum > 0;
}
