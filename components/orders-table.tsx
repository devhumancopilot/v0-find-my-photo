"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Eye,
} from "lucide-react"
import { formatDistance } from "date-fns"

interface Order {
  id: number
  album_id: number
  gelato_order_id: string | null
  status: string
  product_name: string | null
  quantity: number
  total_cost: number | null
  currency: string | null
  tracking_number: string | null
  estimated_delivery_date: string | null
  created_at: string
  albums?: {
    id: number
    album_title: string
    cover_image_url: string | null
  }
}

interface OrdersTableProps {
  orders: Order[]
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-800", icon: Clock },
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  processing: {
    label: "Processing",
    color: "bg-blue-100 text-blue-800",
    icon: Package,
  },
  shipped: {
    label: "Shipped",
    color: "bg-purple-100 text-purple-800",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
}

export function OrdersTable({ orders }: OrdersTableProps) {
  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No orders yet
          </h3>
          <p className="text-gray-600 text-center mb-6">
            You haven't ordered any physical photo albums yet.
            <br />
            Go to an album and click "Print Preview" to get started.
          </p>
          <Link href="/dashboard">
            <Button>Browse Albums</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const statusConfig =
          STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
        const StatusIcon = statusConfig.icon

        return (
          <Card key={order.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {order.albums?.album_title || "Unknown Album"}
                    </h3>
                    <Badge className={statusConfig.color} variant="secondary">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Order #{order.id}</span>
                    {order.gelato_order_id && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Gelato: {order.gelato_order_id.slice(0, 12)}...
                      </span>
                    )}
                    <span>
                      {formatDistance(new Date(order.created_at), new Date(), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {order.total_cost
                      ? `$${order.total_cost.toFixed(2)}`
                      : "—"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {order.quantity} {order.quantity === 1 ? "copy" : "copies"}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm">
                  {order.product_name && (
                    <div>
                      <span className="text-gray-500">Product:</span>
                      <span className="ml-2 font-medium">
                        {order.product_name}
                      </span>
                    </div>
                  )}

                  {order.tracking_number && (
                    <div>
                      <span className="text-gray-500">Tracking:</span>
                      <span className="ml-2 font-mono text-xs">
                        {order.tracking_number}
                      </span>
                    </div>
                  )}

                  {order.estimated_delivery_date && (
                    <div>
                      <span className="text-gray-500">Est. Delivery:</span>
                      <span className="ml-2 font-medium">
                        {new Date(
                          order.estimated_delivery_date
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/albums/${order.album_id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View Album
                    </Button>
                  </Link>

                  {order.tracking_number && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`https://www.google.com/search?q=${order.tracking_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Track
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
