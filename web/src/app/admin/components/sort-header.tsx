import { TableHead } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { buildSearchParams, cn } from "@/lib/utils"

interface SortHeaderProps {
  field: string
  label: string
  className?: string
  sortBy: string
  order: "asc" | "desc"
  params: Record<string, string | string[] | undefined>
}

export const SortHeader = ({ field, label, className, sortBy, order, params }: SortHeaderProps) => {
  const isActive = sortBy === field
  const nextOrder = isActive && order === "asc" ? "desc" : "asc"
  const Icon = !isActive ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown

  return (
    <TableHead className={cn("p-0", className)}>
      <Button 
        variant="ghost" 
        size="sm" 
        asChild 
        className={cn(
          "h-8 w-full justify-start font-bold hover:bg-transparent px-2",
          isActive && "text-primary"
        )}
      >
        <Link href={buildSearchParams(params, { sortBy: field, order: nextOrder, page: "1" })}>
          {label}
          <Icon className="ml-2 h-3 w-3" />
        </Link>
      </Button>
    </TableHead>
  )
}
