// utils/serverCodes.js
const db = require("./db");

function listServerCodes() {
  return db
    .prepare(
      "SELECT server_key, name, code FROM server_codes ORDER BY server_key ASC"
    )
    .all();
}

function getServerCode(serverKey) {
  return db
    .prepare(
      "SELECT server_key, name, code FROM server_codes WHERE server_key = ?"
    )
    .get(serverKey);
}

function upsertServerCode(serverKey, name, code) {
  db.prepare(
    `
    INSERT INTO server_codes (server_key, name, code)
    VALUES (?, ?, ?)
    ON CONFLICT(server_key) DO UPDATE SET
      name = excluded.name,
      code = excluded.code
    `
  ).run(serverKey, name, code);
}

function addServerCode(serverKey, name, code) {
  db.prepare(
    `
    INSERT INTO server_codes (server_key, name, code)
    VALUES (?, ?, ?)
    `
  ).run(serverKey, name, code);
}

function deleteServerCode(serverKey) {
  db.prepare("DELETE FROM server_codes WHERE server_key = ?").run(serverKey);
}

module.exports = {
  listServerCodes,
  getServerCode,
  upsertServerCode,
  addServerCode,
  deleteServerCode,
};
