"use client"

import { usePathname } from "next/navigation"
import { SupplierReturnsV2 } from "@/components/supplier-returns-v2"

export function SupplierReturnsRouteGuard() {
  const pathname = usePathname()

  if (pathname === "/besitzer/to-do") return null

  return <SupplierReturnsV2 />
}
