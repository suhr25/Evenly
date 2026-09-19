"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupHeader } from "@/components/groups/group-header";
import { MemberList } from "@/components/groups/member-list";
import { AddMemberDialog } from "@/components/groups/add-member-dialog";
import { GroupExpenseList } from "@/components/groups/group-expense-list";
import { GroupExpenseFormDialog } from "@/components/groups/group-expense-form-dialog";
import { BalancesPanel } from "@/components/groups/balances-panel";
import { RecordSettlementDialog } from "@/components/groups/record-settlement-dialog";
import { SettlementHistory } from "@/components/groups/settlement-history";
import { SuggestedSettlements } from "@/components/groups/suggested-settlements";
import { ReceiptScanDialog } from "@/components/groups/receipt-scan-dialog";
import { useGroupDetail } from "@/hooks/use-groups";
import { useGroupExpenses } from "@/hooks/use-group-expenses";
import type { GroupExpenseDTO } from "@/hooks/use-group-expenses";

export function GroupDetailClient({ groupId, currency }: { groupId: string; currency: string }) {
  const { data: group, isLoading, isError } = useGroupDetail(groupId);
  const [page, setPage] = useState(1);
  const { data: expensesData, isLoading: expensesLoading } = useGroupExpenses(groupId, page);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GroupExpenseDTO | null>(null);

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border py-20 text-center">
        <p className="font-medium">Group not found</p>
        <p className="text-sm text-muted-foreground">
          It may have been deleted, or you&apos;re not a member of it.
        </p>
      </div>
    );
  }

  if (isLoading || !group) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function openCreateExpense() {
    setEditingExpense(null);
    setExpenseDialogOpen(true);
  }

  function openEditExpense(expense: GroupExpenseDTO) {
    setEditingExpense(expense);
    setExpenseDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <GroupHeader group={group} />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Members</CardTitle>
          <AddMemberDialog groupId={groupId} />
        </CardHeader>
        <CardContent>
          <MemberList groupId={groupId} groupName={group.name} members={group.members} currency={currency} />
        </CardContent>
      </Card>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="flex flex-col gap-4">
          <div className="flex justify-end gap-2">
            <ReceiptScanDialog groupId={groupId} members={group.members} currency={currency} />
            <Button onClick={openCreateExpense}>
              <Plus className="size-4" aria-hidden />
              Add expense
            </Button>
          </div>
          <GroupExpenseList
            groupId={groupId}
            data={expensesData}
            isLoading={expensesLoading}
            currency={currency}
            onEdit={openEditExpense}
            onPageChange={setPage}
          />
        </TabsContent>

        <TabsContent value="balances" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Current balances</h2>
            <RecordSettlementDialog groupId={groupId} members={group.members} />
          </div>
          <BalancesPanel members={group.members} currency={currency} />

          <SuggestedSettlements
            groupId={groupId}
            groupName={group.name}
            suggestions={group.suggestedSettlements}
            currency={currency}
            currentMemberId={group.members.find((m) => m.isYou)?.id ?? null}
          />

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Payment history</h2>
            <SettlementHistory groupId={groupId} currency={currency} />
          </div>
        </TabsContent>
      </Tabs>

      <GroupExpenseFormDialog
        groupId={groupId}
        members={group.members}
        currency={currency}
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        expense={editingExpense}
      />
    </div>
  );
}
