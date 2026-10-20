import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEMO_EXPERIENCES } from "./roblox";
import { fetchRobloxMetadata } from "./roblox-metadata";

export const getRobloxMetadata = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ placeId: z.string().regex(/^\d{1,20}$/) }).parse(input))
  .handler(({ data }) => fetchRobloxMetadata(data.placeId, DEMO_EXPERIENCES.find((e) => e.placeId === data.placeId)));