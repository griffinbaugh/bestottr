import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  ticketNumber?: string;
}

const SupportTicketReceived = ({ ticketNumber }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`We received your request${ticketNumber ? ` — ${ticketNumber}` : ""}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>bestottr</Text>
        <Heading style={h1}>We received your request</Heading>
        <Text style={text}>
          Thanks for contacting bestottr. We created ticket <strong>{ticketNumber ?? "your ticket"}</strong> for you.
        </Text>
        <Text style={text}>Our team will reply by email. Reply to this message to add details, and keep the ticket number in the subject.</Text>
        <Text style={footer}>bestottr Support · support@bestottr.com</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: SupportTicketReceived,
  subject: (d: Record<string, any>) => `[${d["ticketNumber"] ?? "Ticket"}] We received your bestottr support request`,
  displayName: "Support ticket received",
  previewData: { ticketNumber: "BOT-2026-000101" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "-apple-system, Segoe UI, Helvetica, Arial, sans-serif", color: "#111111" };
const container = { maxWidth: "520px", margin: "0 auto", padding: "28px 24px" };
const brand = { fontWeight: 700, fontSize: "16px", margin: "0 0 16px" };
const h1 = { fontSize: "20px", margin: "0 0 12px", color: "#000000" };
const text = { fontSize: "14px", lineHeight: "1.55", margin: "0 0 12px" };
const footer = { fontSize: "12px", color: "#777777", marginTop: "20px" };
