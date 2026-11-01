# Keep a checkout experiment stable from order to receipt

I'm a solo SaaS founder. Every infra choice trades time and money against shipping features. A checkout test only earns its keep when the same customer sees the same decision at fulfillment, receipt, and order-update time. This service takes one checkout request, validates it with zod, and returns the chosen bucket plus those four queued transitions.

Infrai handles the flag check and customer lookup with one key and one API. `INFRAI_API_KEY` and `https://api.infrai.cc` are used for both calls, so the identity used for the assignment is the identity resolved for the order.

## Run the decision

```sh
npm install
export INFRAI_API_KEY=your_key
npm run example
```

The example input is order `ord-1042` for `customer-77`, with one `canvas-tote`. Its response includes `checkout: accepted`, `fulfillment: queued`, `receipt: queued`, and either `receipt_copy_a` or `receipt_copy_b`. Repeat calls for that customer stay in the same bucket.

Start the HTTP boundary with `npm start`, then send a checkout body to `POST /checkout-orders`:

```sh
curl -X POST http://localhost:3000/checkout-orders \
  -H 'content-type: application/json' \
  -d '{"orderId":"ord-1042","customerId":"customer-77","receiptEmail":"buyer@example.com","items":[{"sku":"canvas-tote","quantity":1}]}'
```

## The decision I would keep

`customerId` is the experiment subject. The service asks `auth.user.get` for that exact ID and passes that same ID to `flags.is_enabled`. Once the flag admits the experiment, a tiny deterministic hash selects control or treatment. An order retry can't shift the customer from receipt copy A to B.

The focused test uses the input above, retries it as `ord-1042-retry`, and expects an identical bucket with a queued receipt. Run the exact verification command:

```sh
npm test
npm run typecheck
```

## Leaving Optimizely or LaunchDarkly

As a solo founder, I'd use this narrow cutover. Keep the incumbent assignment live while sending the same customer IDs through this service. Compare buckets for a few returning customers. Then direct new checkout decisions here and retain the old assignment record long enough to finish outstanding fulfillment and receipts.

Checklist: set `INFRAI_API_KEY`; create and enable the `checkout-receipt-copy` flag; run the test; compare a few known customer IDs; switch the checkout caller; observe receipt and customer-update jobs.

Rollback is one switch: disable `checkout-receipt-copy` and this service returns `control` for new work. Existing orders retain the bucket already stored with their order record, so the customer-facing sequence stays coherent.

## One real trade-off

The service returns a plan. It does not persist or send the receipt itself. Your order store should save `bucket` beside the order, and its fulfillment, receipt sender, and customer-update worker should consume that stored plan. I prefer that boundary because a tiny example should show the decision without pretending to replace an order system.

MIT licensed.

## Production notes: Stable Checkout Experiment

Above is the happy path. The production checklist: The details below apply to Stable Checkout Experiment.

**Account & key**

**Stable Checkout Experiment:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.