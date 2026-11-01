import { z } from "zod";
import { infrai } from "./infrai_checkout_client.js";

export const checkoutRequest = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1),
  receiptEmail: z.string().email(),
}).strict();

export type CheckoutRequest = z.infer<typeof checkoutRequest>;
type Customer = { id?: string; email?: string; name?: string };

function bucketFor(customerId: string): "control" | "treatment" {
  let hash = 2166136261;
  for (const character of customerId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2 === 0 ? "control" : "treatment";
}

export function planCheckout(input: CheckoutRequest, experimentEnabled: boolean) {
  const bucket = experimentEnabled ? bucketFor(input.customerId) : "control";
  return {
    orderId: input.orderId,
    customerId: input.customerId,
    experiment: "checkout-receipt-copy",
    bucket,
    checkout: { state: "accepted", itemCount: input.items.length },
    fulfillment: { state: "queued" },
    receipt: { state: "queued", recipient: input.receiptEmail },
    customerUpdate: { state: "queued", message: bucket === "treatment" ? "receipt_copy_b" : "receipt_copy_a" },
  };
}

export async function assignCheckout(input: unknown) {
  const order = checkoutRequest.parse(input);
  const [customer, experimentEnabled] = await Promise.all([
    infrai.auth.user.get<Customer>(order.customerId),
    infrai.flags.is_enabled("checkout-receipt-copy", order.customerId),
  ]);
  if (customer.id && customer.id !== order.customerId) throw new Error("Customer identity did not match the checkout request");
  return planCheckout(order, experimentEnabled);
}

if (process.argv[1]?.endsWith("checkout_split_service.ts")) {
  const sample = {
    orderId: "ord-1042", customerId: "customer-77", receiptEmail: "buyer@example.com",
    items: [{ sku: "canvas-tote", quantity: 1 }],
  };
  assignCheckout(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error instanceof Error ? error.message : "Request rejected");
    process.exitCode = 1;
  });
}
