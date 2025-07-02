import { TableHead, TableHeader, TableRow } from "~/components/ui/table";

export function BoardHeader() {
  return (
    <TableHeader>
      <TableRow className="border-t-2 border-b-2 border-primary bg-muted/50">
        <TableHead className="w-[80px] text-center font-semibold text-foreground">
          번호
        </TableHead>
        <TableHead className="font-semibold text-foreground">제목</TableHead>
        <TableHead className="w-[120px] text-center font-semibold text-foreground">
          작성자
        </TableHead>
        <TableHead className="w-[100px] text-center font-semibold text-foreground">
          날짜
        </TableHead>
        <TableHead className="w-[80px] text-center font-semibold text-foreground">
          조회
        </TableHead>
        <TableHead className="w-[80px] text-center font-semibold text-foreground">
          추천
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}