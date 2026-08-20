import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const createRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ isPublic: z.boolean(), maxPlayers: z.number().int().min(2).max(4), bots: z.number().int().min(0).max(3) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./game.server");
    const room = await g.createRoom(await g.admin(), context.userId, data);
    return { code: room.code };
  });

export const joinRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(4).max(8) }).parse(input))
  .handler(async ({ data, context }) => {
    const g = await import("./game.server");
    const room = await g.joinRoom(await g.admin(), context.userId, data.code);
    return { code: room.code };
  });

export const quickMatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const g = await import("./game.server");
    const room = await g.quickMatch(await g.admin(), context.userId);
    return { code: room.code };
  });

export const leaveRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const g = await import("./game.server");
    await g.leaveRoom(await g.admin(), context.userId, data.roomId);
    return { ok: true };
  });

export const startMatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const g = await import("./game.server");
    await g.startMatch(await g.admin(), context.userId, data.roomId);
    return { ok: true };
  });

export const rollDiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const g = await import("./game.server");
    const state = await g.rollDice(await g.admin(), context.userId, data.roomId);
    return { dice: state.dice };
  });

export const movePieceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ roomId: z.string().uuid(), piece: z.number().int().min(0).max(3) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./game.server");
    await g.movePiece(await g.admin(), context.userId, data.roomId, data.piece);
    return { ok: true };
  });

export const autoStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const g = await import("./game.server");
    await g.autoStep(await g.admin(), data.roomId);
    return { ok: true };
  });

export const sendChatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ roomId: z.string().uuid(), content: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./game.server");
    await g.sendChat(await g.admin(), context.userId, data.roomId, data.content);
    return { ok: true };
  });

export const buyItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const g = await import("./game.server");
    return await g.buyItem(await g.admin(), context.userId, data.itemId);
  });

export const equipItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const g = await import("./game.server");
    return await g.equipItem(await g.admin(), context.userId, data.itemId);
  });

export const myProfileFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const g = await import("./game.server");
    return await g.getProfile(await g.admin(), context.userId);
  });