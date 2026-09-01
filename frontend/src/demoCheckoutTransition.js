export const STRIPE_TEST_CARD = '4242424242424242';

export async function copyStripeTestCard(writeText) {
  if (typeof writeText !== 'function') return false;
  try {
    await writeText(STRIPE_TEST_CARD);
    return true;
  } catch {
    return false;
  }
}

export async function prepareStripeRedirect({ writeText, createCheckout }) {
  const copied = await copyStripeTestCard(writeText);
  if (!copied) return { copied: false, checkout: null };
  return { copied: true, checkout: await createCheckout() };
}
