// Transactional email hook points for support. No provider is connected yet,
// so these are no-ops that report `sent: false`. Swap in Resend/Postmark/etc.
// here (reading the API key from process.env inside the function).
export type SupportEmailEvent =
  | { kind: "customer_ack"; to: string; ticketNumber: string }
  | { kind: "support_notify"; ticketNumber: string; category: string }
  | { kind: "status_update"; to: string; ticketNumber: string; status: string };

export const EMAIL_PROVIDER_CONNECTED = false;

export async function sendSupportEmail(_e: SupportEmailEvent): Promise<{ sent: boolean }> {
  return { sent: false };
}
