import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  ticketNumber?: string;
  category?: string;
  customerEmail?: string;
}

const ADMIN_URL = "https://bestottr.com/admin/support";

const SupportNewTicket = ({ ticketNumber, category, customerEmail }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New support ticket ${ticketNumber ?? ""}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>bestottr</Text>
        <Heading style={h1}>New support ticket</Heading>
        <Text style={text}>Ticket: {ticketNumber ?? "—"}</Text>
        <Text style={text}>Topic: {category ?? "—"}</Text>
        <Text style={text}>Customer: {customerEmail ?? "not provided"}</Text>
        <Button href={ADMIN_URL} style={button}>Open support queue</Button>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: SupportNewTicket,
  subject: (d: Record<string, any>) => `[${d["ticketNumber"] ?? "Ticket"}] New support ticket — ${d["category"] ?? "Support"}`,
  displayName: "New support ticket (team)",
  to: "support@bestottr.com",
  previewData: { ticketNumber: "BOT-2026-000101", category: "Technical issue", customerEmail: "jane@example.com" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "-apple-system, Segoe UI, Helvetica, Arial, sans-serif", color: "#111111" };
const container = { maxWidth: "520px", margin: "0 auto", padding: "28px 24px" };
const brand = { fontWeight: 700, fontSize: "16px", margin: "0 0 16px" };
const h1 = { fontSize: "20px", margin: "0 0 12px", color: "#000000" };
const text = { fontSize: "14px", lineHeight: "1.55", margin: "0 0 6px" };
const button = { display: "inline-block", marginTop: "16px", padding: "10px 16px", backgroundColor: "#000000", color: "#ffffff", borderRadius: "6px", fontSize: "14px", textDecoration: "none" };
