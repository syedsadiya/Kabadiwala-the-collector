const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');

const databasePath = require.resolve('../config/db');
const userPath = require.resolve('../models/User');
const serverPath = require.resolve('../server');
const originalLoad = Module._load;
const originalListen = express.application.listen;
const previousEnvironment = {
  jwtSecret: process.env.JWT_SECRET,
  groqKey: process.env.GROQ_API_KEY,
  port: process.env.PORT,
};
const fakeConnectDB = async () => {};
fakeConnectDB.db = {
  prepare() {
    throw new Error('The server-startup smoke test must not access SQLite.');
  },
};
let httpServer;

process.env.JWT_SECRET = 'server-startup-test-secret';
process.env.PORT = '0';
delete process.env.GROQ_API_KEY;

express.application.listen = function (...args) {
  httpServer = originalListen.apply(this, args);
  return httpServer;
};

Module._load = function (request, parent, isMain) {
  let resolvedPath;
  try {
    resolvedPath = Module._resolveFilename(request, parent, isMain);
  } catch {
    return originalLoad.call(this, request, parent, isMain);
  }
  if (resolvedPath === databasePath) return fakeConnectDB;
  if (resolvedPath === userPath && parent.filename === serverPath) {
    return { countDocuments: async () => 1 };
  }
  return originalLoad.call(this, request, parent, isMain);
};

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function run() {
  try {
    require('../server');
    for (let attempt = 0; attempt < 100 && !httpServer; attempt += 1) await wait(20);
    assert.ok(httpServer, 'Backend should start and listen');

    const address = httpServer.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const unauthenticated = await fetch(`${baseUrl}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });
    assert.equal(unauthenticated.status, 401);

    const token = jwt.sign({ id: 'startup-test-user', role: 'customer' }, process.env.JWT_SECRET);
    const noKey = await fetch(`${baseUrl}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: 'How do I recycle a bottle?' }),
    });
    assert.equal(noKey.status, 503);
    assert.match((await noKey.json()).message, /GROQ_API_KEY/);

    console.log('Backend startup smoke tests passed (4 checks, SQLite untouched).');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    Module._load = originalLoad;
    express.application.listen = originalListen;
    if (previousEnvironment.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousEnvironment.jwtSecret;
    if (previousEnvironment.groqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousEnvironment.groqKey;
    if (previousEnvironment.port === undefined) delete process.env.PORT;
    else process.env.PORT = previousEnvironment.port;
  }
}

run();
