import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';

// Exercise actual HTTP/cache behavior, not inspector-only request cancellation.
export async function downloadFailureServer(upstream: string) {
  let blocked = true;
  const server = createServer((incoming, outgoing) => {
    if (blocked && /\/assets\/codex-scene-[^/]+\.js(?:\?|$)/.test(incoming.url ?? '')) {
      outgoing.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      outgoing.end('Temporarily unavailable');
      return;
    }
    const target = new URL(incoming.url ?? '/', upstream);
    const forwarded = request(target, { headers: { ...incoming.headers, host: target.host } }, response => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });
    forwarded.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
    incoming.pipe(forwarded);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    restore: () => { blocked = false; },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
