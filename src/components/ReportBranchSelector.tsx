import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_REPORT_BRANCHES } from '@/lib/reportBranch';
import type { useReportBranch } from '@/hooks/useReportBranch';

export function ReportBranchSelector({ scope }: { scope: ReturnType<typeof useReportBranch> }) {
  if (!scope.isAdmin) return null;
  return (
    <Select value={scope.selectedBranch} onValueChange={scope.setSelectedBranch}>
      <SelectTrigger aria-label="Report branch" className="w-full sm:w-[240px]"><SelectValue placeholder="Select branch" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_REPORT_BRANCHES}>All branches</SelectItem>
        {scope.branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name} ({branch.code})</SelectItem>)}
      </SelectContent>
    </Select>
  );
}