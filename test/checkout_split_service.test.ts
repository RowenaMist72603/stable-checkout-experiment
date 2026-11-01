import assert from "node:assert/strict";
import test from "node:test";
import { checkoutRequest, planCheckout } from "../src/checkout_split_service.js";

test("a returning customer keeps the same receipt experiment bucket", () => {
  const checkout = checkoutRequest.parse({
    orderId: "ord-1042", customerId: "customer-77", receiptEmail: "buyer@example.com",
    items: [{ sku: "canvas-tote", quantity: 1 }],
  });
  const first = planCheckout(checkout, true);
  const retry = planCheckout({ ...checkout, orderId: "ord-1042-retry" }, true);

  assert.equal(first.bucket, retry.bucket);
  assert.equal(first.receipt.state, "queued");
  assert.equal(first.customerUpdate.message, first.bucket === "treatment" ? "receipt_copy_b" : "receipt_copy_a");
});
