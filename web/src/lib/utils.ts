import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function buildSearchParams(
  params: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined> = {}
) {
  const searchParams = new URLSearchParams()
  
  // Combine current params and overrides
  const combined = { ...params, ...overrides }
  
  Object.entries(combined).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    
    if (Array.isArray(value)) {
      value.forEach((v) => {
        searchParams.append(key, v)
      })
    } else {
      searchParams.set(key, value)
    }
  })
  
  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ""
}
