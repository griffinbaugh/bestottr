// Exercise request construction in workerd, not just Node's more permissive fetch.
// Uses Wrangler's installed Miniflare runtime; no external Roblox calls or credentials.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = wranglerRequire("miniflare");
const root = fileURLToPath(new URL("../", import.meta.url));
const { outputFiles } = await build({
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  stdin: {
    resolveDir: root,
    contents: `
    import { verifyDraftOwnership } from './src/lib/listing-ownership.server.ts';
    export default { async fetch() {
      try {
        let calls = 0;
        const request = async (input, init) => {
          const r = new Request(input, init);
          if (r.redirect !== 'manual') throw new Error('Expected manual redirects');
          calls++;
          if (r.url.includes('/places/100/universe')) return Response.json({ universeId: 200 });
          if (r.url === 'https://develop.roblox.com/v1/universes/200') return Response.json({ id: 200, name: 'Game', rootPlaceId: 100, creatorType: 'Group', creatorTargetId: 300, isActive: false, privacyType: 'Private' });
          if (r.url === 'https://groups.roblox.com/v2/groups?groupIds=300') return Response.json({ data: [{ id: 300, name: 'Group', owner: { id: 42, type: 'User' } }] });
          throw new Error('Unexpected endpoint');
        };
        const result = await verifyDraftOwnership('experience', 'https://www.roblox.com/games/100', '42', request);
        if (result.asset_id !== '200' || calls !== 3) throw new Error('Ownership lookup failed');
        let rejected = false;
        try {
          await verifyDraftOwnership('community', 'https://www.roblox.com/communities/300', '42', async (input, init) => {
            new Request(input, init);
            return new Response(null, { status: 302, headers: { Location: 'https://example.invalid/' } });
          });
        } catch (error) { rejected = error.message.includes('Roblox is unavailable'); }
        if (!rejected) throw new Error('Redirect was not rejected safely');
        return Response.json({ ok: true, calls, redirectsRejected: true });
      } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
    }};
  `,
  },
});
const mf = new Miniflare({
  workers: [
    {
      config: {
        name: "ownership-test",
        compatibilityDate: "2026-04-01",
        manifest: {
          mainModule: "index.js",
          modules: { "index.js": { type: "esm", contents: outputFiles[0].text } },
        },
      },
    },
  ],
});
try {
  const response = await mf.dispatchFetch("https://worker.test/");
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.deepEqual(result, { ok: true, calls: 3, redirectsRejected: true });
  console.log("PASS: ownership lookup and redirect rejection in Cloudflare workerd");
} finally {
  await mf.dispose();
}
