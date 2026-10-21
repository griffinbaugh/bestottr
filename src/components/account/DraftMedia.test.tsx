import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  list: vi.fn(),
  cover: vi.fn(),
  move: vi.fn(),
  remove: vi.fn(),
  prepare: vi.fn(),
  finish: vi.fn(),
  download: vi.fn(),
}));
vi.mock("@/lib/listing-assets.functions", () => ({
  getDraftAssets: h.list,
  setDraftCover: h.cover,
  moveDraftImage: h.move,
  deleteDraftUpload: h.remove,
  prepareDraftUpload: h.prepare,
  finishDraftUpload: h.finish,
  downloadDraftFile: h.download,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ uploadToSignedUrl: vi.fn() }) } },
}));
vi.mock("./AccountLayout", () => ({
  Message: ({ error, success }: any) => (
    <div>
      {error}
      {success}
    </div>
  ),
}));
import { DraftMedia } from "./DraftMedia";
const draft = {
  id: "aa000000-0000-4000-8000-000000000001",
  kind: "file" as const,
  url: "",
  title: "Model pack",
  description: "A collection of models",
  format: "buy_now" as const,
  priceCents: 1234,
  reserveCents: null,
};
const image = (id: string) => ({
  id,
  category: "image",
  status: "ready",
  filename: `${id}.png`,
  url: `https://storage.example/${id}`,
  size_bytes: 20,
});
beforeEach(() => {
  vi.clearAllMocks();
  h.list.mockResolvedValue([
    image("first"),
    image("second"),
    {
      id: "file",
      category: "file",
      status: "ready",
      filename: "Models.zip",
      size_bytes: 1024,
      url: null,
    },
  ]);
  h.cover.mockResolvedValue({ ok: true });
  h.move.mockResolvedValue({ ok: true });
  h.remove.mockResolvedValue({ ok: true });
});
afterEach(cleanup);
it("previews current listing edits with a cover without exposing deliverable download URLs", async () => {
  render(<DraftMedia token="qa-session" draft={draft} coverId="second" onCoverChange={() => {}} />);
  await screen.findByText("Models.zip");
  fireEvent.click(screen.getByRole("button", { name: "Preview listing" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Model pack");
  expect(screen.getByRole("dialog")).toHaveTextContent("$12.34");
  expect(screen.getByRole("dialog")).toHaveTextContent("1 deliverable files prepared");
  expect(screen.getByRole("button", { name: "Checkout not open" })).toBeDisabled();
  expect(h.download).not.toHaveBeenCalled();
});
it("saves cover selection and image order through authenticated actions", async () => {
  const changed = vi.fn();
  render(<DraftMedia token="qa-session" draft={draft} coverId="first" onCoverChange={changed} />);
  await screen.findByText("Models.zip");
  fireEvent.click(screen.getByRole("button", { name: "Set cover" }));
  await waitFor(() => expect(changed).toHaveBeenCalledWith("second"));
  expect(h.cover).toHaveBeenCalledWith({ data: { token: "qa-session", id: "second" } });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Move second.png earlier" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Move second.png earlier" }));
  await waitFor(() =>
    expect(h.move).toHaveBeenCalledWith({
      data: { token: "qa-session", id: "second", direction: "earlier" },
    }),
  );
});
it("requires confirmation before deleting a stored upload", async () => {
  render(<DraftMedia token="qa-session" draft={draft} coverId="first" onCoverChange={() => {}} />);
  await screen.findByText("Models.zip");
  fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
  expect(h.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Remove upload" }));
  await waitFor(() =>
    expect(h.remove).toHaveBeenCalledWith({ data: { token: "qa-session", id: "first" } }),
  );
});
it("rejects unsupported image types before reserving a storage upload", async () => {
  render(<DraftMedia token="qa-session" draft={draft} coverId={null} onCoverChange={() => {}} />);
  await screen.findByText("Models.zip");
  const file = new File(["x"], "cover.svg", { type: "image/svg+xml" });
  fireEvent.change(screen.getByLabelText("Add listing images"), { target: { files: [file] } });
  await screen.findByText("Images must be PNG, JPEG or WebP, up to 5 MB.");
  expect(h.prepare).not.toHaveBeenCalled();
});
