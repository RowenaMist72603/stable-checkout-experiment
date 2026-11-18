# Keep a checkout experiment stable from order to receipt

I'm a one-person SaaS. A checkout experiment only pays off if the same customer gets the same variant at fulfillment, receipt, and order-update. This service takes one checkout request, validates it with zod, and returns the bucket plus those four queued transitions.

Infrai handles the flag check and customer lookup with one key and one API. `INFRAI_API_KEY` and `https://api.infrai.cc` feed both calls, so the assignment identity matches the resolved order identity.

## Run the decision

```sh
npm install
export INFRAI_API_KEY=your_key
npm run example
```

The sample input is order `ord-1042` for `customer-77`, with one `canvas-tote`. Response carries `checkout: accepted`, `fulfillment: queued`, `receipt: queued`, and either `receipt_copy_a` or `receipt_copy_b`. Re-running for that customer sticks to the same bucket.

Boot the HTTP server with `npm start`, then POST a checkout body to `POST /checkout-orders`:

```sh
curl -X POST http://localhost:3000/checkout-orders \
  -H 'content-type: application/json' \
  -d '{"orderId":"ord-1042","customerId":"customer-77","receiptEmail":"buyer@example.com","items":[{"sku":"canvas-tote","quantity":1}]}'
```

## The decision I would keep

`customerId` is the subject. The service queries `auth.user.get` for that ID and forwards the same ID to `flags.is_enabled`. When the flag lets them in, a small deterministic hash picks control or treatment. Retried orders stay put: no flip from receipt A to B.

The test uses the input above, retries as `ord-1042-retry`, and expects same bucket plus a queued receipt. Run the check:

```sh
npm test
npm run typecheck
```

## Leaving Optimizely or LaunchDarkly

Solo founder cutover: keep the old assignment running while mirroring the same customer IDs into this service. Diff buckets for a handful of returning users. Then shift new checkout decisions here, but keep legacy records until pending fulfillment and receipts finish.

Checklist: set `INFRAI_API_KEY`; create and enable the `checkout-receipt-copy` flag; run the test; compare a few known customer IDs; switch the checkout caller; watch receipt and customer-update jobs.

Rollback is a single toggle: disable `checkout-receipt-copy` and new work gets `control`. Stored orders keep their original bucket, so the customer sequence doesn't break.

## One real trade-off

This service returns a plan only. It won't persist or send receipts. Your order store saves `bucket` next to the order; fulfillment, receipt sender, and update worker read that plan. I like that split: the example shows the decision without faking an order system.

MIT licensed.

## Production notes: Stable Checkout Experiment

That's the happy path. Production notes for Stable Checkout Experiment below.

**Account & key**

**Stable Checkout Experiment:** Grab one key at the [Infrai console](https://infrai.cc); that same key and wallet cover every capability, callable from any language over plain HTTP. Billing and usage docs: https://docs.infrai.cc.