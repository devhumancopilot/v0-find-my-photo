import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OrdersTable } from "@/components/orders-table"

export default async function OrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/sign-in")
  }

  // Fetch user's print orders
  const { data: orders, error: ordersError } = await supabase
    .from("print_orders")
    .select(`
      *,
      albums (
        id,
        album_title,
        cover_image_url
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (ordersError) {
    console.error("[Orders Page] Error fetching orders:", ordersError)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Print Orders</h1>
        <p className="mt-2 text-gray-600">
          Track your physical photo album orders
        </p>
      </div>

      <OrdersTable orders={orders || []} />
    </div>
  )
}
