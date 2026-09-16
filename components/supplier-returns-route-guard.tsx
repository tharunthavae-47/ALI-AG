"use client"

import { usePathname } from "next/navigation"
import { SupplierReturnsV2 } from "@/components/supplier-returns-v2"

export function SupplierReturnsRouteGuard() {
  const pathname = usePathname()

  // Die Lieferanten-Retouren sollen nicht im Kunden-ERP erscheinen.
  if (pathname === "/besitzer/to-do" || pathname === "/besitzer/kunden") return null

  return <SupplierReturnsV2 />
}
