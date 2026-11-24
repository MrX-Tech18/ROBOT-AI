import { createApp } from '../server.ts';

const port = Number(process.env.PORT || 3000);

createApp()
  .then((app) => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`ROBOT OFFICE AI server running on http://0.0.0.0:${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
