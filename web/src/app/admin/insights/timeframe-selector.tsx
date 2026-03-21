"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"

export function TimeframeSelector({ currentDays }: { currentDays: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleValueChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "30") {
      params.delete("days")
    } else {
      params.set("days", value)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <Select value={currentDays.toString()} onValueChange={handleValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select timeframe" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Last 7 days</SelectItem>
        <SelectItem value="14">Last 14 days</SelectItem>
        <SelectItem value="30">Last 30 days</SelectItem>
        <SelectItem value="60">Last 60 days</SelectItem>
        <SelectItem value="90">Last 90 days</SelectItem>
        <SelectItem value="180">Last 6 months</SelectItem>
        <SelectItem value="365">Last year</SelectItem>
      </SelectContent>
    </Select>
  )
}
