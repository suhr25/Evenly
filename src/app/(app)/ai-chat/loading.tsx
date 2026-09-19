import { Skeleton } from "@/components/ui/skeleton";

export default function AiChatLoading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 md:h-[calc(100vh-4rem)]">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="flex-1 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
