"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert } from "@/components/ui/alert"
import { Loader2, Package, Truck, DollarSign, Check, AlertCircle } from "lucide-react"
import type { PhotoBookProduct } from "@/lib/gelato/types"

interface PrintOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  albumId: string
  albumTitle: string
  photoCount: number
  layoutTemplate: string
}

export function PrintOrderDialog({
  open,
  onOpenChange,
  albumId,
  albumTitle,
  photoCount,
  layoutTemplate,
}: PrintOrderDialogProps) {
  // State
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<PhotoBookProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [pageCount, setPageCount] = useState<number>(24)
  const [quantity, setQuantity] = useState<number>(1)
  const [quote, setQuote] = useState<any>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [generatingPDF, setGeneratingPDF] = useState(false)

  // Shipping form
  const [shippingForm, setShippingForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postCode: "",
    stateCode: "",
    country: "US",
  })

  // Load products on mount
  useEffect(() => {
    if (open) {
      loadProducts()
      // Calculate estimated page count based on photo count and layout
      const estimatedPages = calculatePageCount(photoCount, layoutTemplate)
      setPageCount(estimatedPages)
    }
  }, [open, photoCount, layoutTemplate])

  // Load products from API
  const loadProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/gelato/products")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load products")
      }

      setProducts(data.products)
      if (data.products.length > 0) {
        setSelectedProduct(data.products[0].uid)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  // Get quote when product or shipping details change
  useEffect(() => {
    if (selectedProduct && shippingForm.country && step === 2) {
      getQuote()
    }
  }, [selectedProduct, pageCount, quantity, shippingForm.country, step])

  // Get price quote
  const getQuote = async () => {
    try {
      setQuoteLoading(true)
      setError("")

      const response = await fetch("/api/gelato/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUid: selectedProduct,
          pageCount,
          quantity,
          country: shippingForm.country,
          city: shippingForm.city,
          postCode: shippingForm.postCode,
          stateCode: shippingForm.stateCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get quote")
      }

      setQuote(data.quote)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get quote")
    } finally {
      setQuoteLoading(false)
    }
  }

  // Place order
  const placeOrder = async () => {
    try {
      setLoading(true)
      setError("")
      setGeneratingPDF(true)

      // Step 1: Generate PDF from album
      const pdfResponse = await fetch("/api/gelato/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId,
          layoutTemplate,
        }),
      })

      const pdfData = await pdfResponse.json()

      if (!pdfResponse.ok) {
        throw new Error(pdfData.error || "Failed to generate PDF")
      }

      const fileUrl = pdfData.fileUrl
      setGeneratingPDF(false)

      // Step 2: Place order with Gelato
      const response = await fetch("/api/gelato/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId,
          productUid: selectedProduct,
          pageCount,
          quantity,
          fileUrl,
          layoutTemplate,
          recipient: shippingForm,
          shippingMethod: "standard",
          unitPrice: quote?.unitPrice,
          shippingCost: quote?.shippingCost,
          totalCost: quote?.totalCost,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to place order")
      }

      // Success!
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order")
    } finally {
      setLoading(false)
      setGeneratingPDF(false)
    }
  }

  // Helper: Calculate page count
  const calculatePageCount = (photos: number, layout: string): number => {
    const photosPerPage: Record<string, number> = {
      "single-per-page": 1,
      "grid-2x2": 4,
      "grid-3x3": 9,
      "grid-4x4": 16,
      "collage": 6,
    }

    const pagesNeeded = Math.ceil(photos / (photosPerPage[layout] || 4))
    return Math.max(pagesNeeded + 1, 24) // Add 1 for cover, minimum 24 pages
  }

  // Get selected product details
  const selectedProductDetails = products.find((p) => p.uid === selectedProduct)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1)
      setError("")
      setQuote(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Fixed Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Order Physical Photo Album</DialogTitle>
            <DialogDescription className="text-base">
              Print your "{albumTitle}" album with {photoCount} photos
            </DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-1 mt-6">
            <div className={`flex items-center gap-2 ${step >= 1 ? "text-blue-600" : "text-gray-400"}`}>
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 ${step >= 1 ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}>
                {step > 1 ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Product</span>
            </div>
            <div className="w-8 sm:w-12 h-[2px] bg-gray-300 mx-1"></div>
            <div className={`flex items-center gap-2 ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}>
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 ${step >= 2 ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}>
                {step > 2 ? <Check className="h-4 w-4" /> : "2"}
              </div>
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Shipping</span>
            </div>
            <div className="w-8 sm:w-12 h-[2px] bg-gray-300 mx-1"></div>
            <div className={`flex items-center gap-2 ${step >= 3 ? "text-blue-600" : "text-gray-400"}`}>
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 ${step >= 3 ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}>
                {step > 3 ? <Check className="h-4 w-4" /> : "3"}
              </div>
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Confirm</span>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <div className="ml-2">{error}</div>
            </Alert>
          )}

          {/* Step 1: Product Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="product">Select Product</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a photo book style" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.uid} value={product.uid}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProductDetails && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {selectedProductDetails.name}
                  </CardTitle>
                  <CardDescription>
                    {selectedProductDetails.size.replace(/-/g, " ")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Cover Type:</span>
                    <Badge variant="secondary">{selectedProductDetails.coverType}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Paper:</span>
                    <span className="font-medium">170 GSM Silk</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Page Range:</span>
                    <span className="font-medium">
                      {selectedProductDetails.minPages}-{selectedProductDetails.maxPages} pages
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pageCount">Page Count</Label>
                <Input
                  id="pageCount"
                  type="number"
                  min={selectedProductDetails?.minPages || 24}
                  max={selectedProductDetails?.maxPages || 200}
                  value={pageCount}
                  onChange={(e) => setPageCount(parseInt(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Estimated based on {photoCount} photos
                </p>
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={10}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Shipping Information */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={shippingForm.firstName}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, firstName: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={shippingForm.lastName}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, lastName: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={shippingForm.email}
                onChange={(e) =>
                  setShippingForm({ ...shippingForm, email: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="addressLine1">Address Line 1 *</Label>
              <Input
                id="addressLine1"
                value={shippingForm.addressLine1}
                onChange={(e) =>
                  setShippingForm({ ...shippingForm, addressLine1: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                value={shippingForm.addressLine2}
                onChange={(e) =>
                  setShippingForm({ ...shippingForm, addressLine2: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={shippingForm.city}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, city: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="postCode">Postal Code *</Label>
                <Input
                  id="postCode"
                  value={shippingForm.postCode}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, postCode: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="stateCode">State/Province</Label>
                <Input
                  id="stateCode"
                  value={shippingForm.stateCode}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, stateCode: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="country">Country *</Label>
                <Select
                  value={shippingForm.country}
                  onValueChange={(value) =>
                    setShippingForm({ ...shippingForm, country: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                    <SelectItem value="AU">Australia</SelectItem>
                    <SelectItem value="DE">Germany</SelectItem>
                    <SelectItem value="FR">France</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {quote && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Pricing Estimate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Product Cost:</span>
                    <span className="font-medium">${quote.totalProductCost?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Shipping:</span>
                    <span className="font-medium">${quote.shippingCost?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      <Truck className="inline h-3 w-3 mr-1" />
                      Estimated Delivery:
                    </span>
                    <span>{quote.estimatedDeliveryDays || 7} business days</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total:</span>
                    <span>${quote.totalCost?.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {quoteLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-600">Getting price quote...</span>
              </div>
            )}

            {generatingPDF && (
              <div className="flex items-center justify-center py-4 bg-blue-50 rounded-lg border border-blue-200">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-blue-700 font-medium">
                  Generating print-ready PDF... This may take a moment.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Order Confirmation */}
        {step === 3 && (
          <div className="text-center py-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h3>
            <p className="text-gray-600 mb-6">
              Your photo album order has been submitted to Gelato for printing.
              You'll receive a confirmation email shortly.
            </p>
            <Alert className="text-left">
              <Package className="h-4 w-4" />
              <div className="ml-2">
                <p className="font-medium">What's Next?</p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>• You'll receive an order confirmation email</li>
                  <li>• Your album will be printed within 1-2 business days</li>
                  <li>• Tracking information will be sent when shipped</li>
                  <li>• Expected delivery in {quote?.estimatedDeliveryDays || 7} business days</li>
                </ul>
              </div>
            </Alert>
          </div>
        )}
        </div>

        {/* Fixed Footer */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedProduct || loading}
              >
                Continue to Shipping
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={placeOrder}
                disabled={
                  loading ||
                  !shippingForm.firstName ||
                  !shippingForm.lastName ||
                  !shippingForm.email ||
                  !shippingForm.addressLine1 ||
                  !shippingForm.city ||
                  !shippingForm.postCode ||
                  !shippingForm.country
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Place Order
              </Button>
            </>
          )}

          {step === 3 && (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
