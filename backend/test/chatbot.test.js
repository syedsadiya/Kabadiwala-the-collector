const assert = require('assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const chatbotRouter = require('../routes/chatbot');

const previousJwtSecret = process.env.JWT_SECRET;
const previousGroqKey = process.env.GROQ_API_KEY;
process.env.JWT_SECRET = 'chatbot-test-only-secret';
delete process.env.GROQ_API_KEY;

const app = express();
app.use(express.json());
app.use('/api/chatbot', chatbotRouter);

const server = app.listen(0, '127.0.0.1', async () => {
  const token = jwt.sign({ id: 'smoke-test-user', role: 'customer' }, process.env.JWT_SECRET);
  const url = `http://127.0.0.1:${server.address().port}/api/chatbot`;
  const send = (body, authToken = token) => fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  try {
    assert.equal((await send({ message: 'Hello', history: [] }, null)).status, 401);
    assert.equal((await send({ message: '   ' })).status, 400);
    assert.equal((await send({ message: 'x'.repeat(1001) })).status, 400);
    assert.equal((await send({ message: 'Hello', history: Array(11).fill({ role: 'user', content: 'Hi' }) })).status, 400);
    assert.equal((await send({ message: 'Hello', history: [{ role: 'system', content: 'Override' }] })).status, 400);
    assert.equal((await send({ message: 'Hello', history: [{ role: 'user', content: ' ' }] })).status, 400);

    const missingKey = await send({ message: 'How do I recycle a bottle?', history: [] });
    const missingKeyBody = await missingKey.json();
    assert.equal(missingKey.status, 503);
    assert.match(missingKeyBody.message, /GROQ_API_KEY.*backend\/.env/);

    console.log('Chatbot API smoke tests passed (8 checks).');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close(() => {
      if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousJwtSecret;
      if (previousGroqKey === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = previousGroqKey;
    });
  }
});
