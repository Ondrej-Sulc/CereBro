"use client"

import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition, useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useDebouncedCallback } from "use-debounce"

interface FilterOption {
  label: string
  value: string
}

interface TableFiltersProps {
  placeholder?: string
  filters?: {
    name: string
    label: string
    pluralLabel?: string
    options: FilterOption[]
  }[]
}

export function TableFilters({ placeholder = "Search...", filters = [] }: TableFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState(searchParams.get("query") || "")

  // Sync state when URL changes (e.g. Back button or external updates)
  useEffect(() => {
    setQuery(searchParams.get("query") || "")
  }, [searchParams])

  const debouncedPush = useDebouncedCallback((queryString: string) => {
    startTransition(() => {
      router.push(`${pathname}?${queryString}`)
    })
  }, 300)

  function handleSearch(term: string) {
    setQuery(term)
    const params = new URLSearchParams(searchParams)
    params.set("page", "1")
    if (term) {
      params.set("query", term)
    } else {
      params.delete("query")
    }
    debouncedPush(params.toString())
  }

  function handleFilterChange(name: string, value: string) {
    const params = new URLSearchParams(searchParams)
    params.set("page", "1")
    if (value && value !== "all") {
      params.set(name, value)
    } else {
      params.delete(name)
    }
    debouncedPush(params.toString())
  }

  function clearFilters() {
    debouncedPush.cancel()
    startTransition(() => {
      router.push(`${pathname}`)
    })
  }

  const hasFilters = searchParams.size > 0 && !(searchParams.size === 1 && searchParams.has("page"))

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={placeholder}
          className="pl-8 md:max-w-[300px]"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <Select
            key={filter.name}
            value={searchParams.get(filter.name) || "all"}
            onValueChange={(value) => handleFilterChange(filter.name, value)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All {filter.pluralLabel ?? filter.label}
              </SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters} className="h-10 px-2 lg:px-3">
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
