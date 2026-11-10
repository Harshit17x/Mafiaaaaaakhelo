import { createMidnightCityServer } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const server = createMidnightCityServer();

server.httpServer.listen(port, () => {
  console.log(`Midnight City server listening on port ${port}`);
});

