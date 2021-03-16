const Queue = require("queue-fifo");
const shell = require("shelljs");
const fs = require("fs");
const SQLiteMessagesDB = `${process.env.HOME}/Library/Messages/chat.db`;
const sqlite3 = require("sqlite3").verbose();

if (!fs.existsSync(SQLiteMessagesDB)) {
  return;
}

const db = new sqlite3.Database(SQLiteMessagesDB);

let didCancelSend = false;

// isSending is set true when a message is actively being sent by applescript
var isSending = false;

// instantiate a queue to store messages in
var messageQueue = new Queue();

const debugging = false;

const log = (message) => {
  if (!debugging) {
    return;
  }

  console.log(message);
};

const getChatGUIDFromSQLiteDB = async (chatTitle) => {
  if (!chatTitle || String(chatTitle).length === 0) {
    log(`no chat title given, returning false`);

    return false;
  }

  const sql = `SELECT guid FROM chat WHERE chat.display_name = '${chatTitle}' OR chat.chat_identifier = '${chatTitle}'`;

  const result = await new Promise((resolve) => {
    db.serialize(function () {
      db.all(sql, function (err, rows) {
        log(`got results from SQL query:`);
        log(err);
        log(rows);
        console.log(rows);
        if (!rows || !rows.length) {
          return resolve(false);
        }
        const theRow = rows.filter((r) => r.guid.includes("iMessage"))[0];
        if (!theRow) {
          return resolve(new Error("This is SMS!"));
          // return resolve("SMS_ONLY");
        }

        return resolve(theRow.guid);
      });
    });
  });

  return result;
};

const _osascriptSendMessageToChat = async (
  chatTitle,
  chatMessage,
  callback
) => {
  const finishedWithSend = (message = null) => {
    isSending = false;

    callback(message, null);

    if (didCancelSend) {
      log(`due to previously cancelled send, sending more messages from queue`);

      didCancelSend = false;
      sendMessagesFromQueue();
    }
  };

  // need to retrieve chatGUID from chatTitle
  let chatGUID = await getChatGUIDFromSQLiteDB(chatTitle);
  if (chatGUID instanceof Error) {
    return callback(null, chatGUID);
  }
  //   return;
  //   if (!chatGUID) {
  // 	  console.log
  //   }
  //   console.log(chatGUID);
  //   return chatGUID;
  //   if (chatGUID === "SMS_ONLY") {
  // 	  return finishedWithSend("SMS_ONLY")
  //   }

  if (!chatGUID) {
    log(
      `unable to look up chatGUID for ${chatTitle}, using automator to start a new chat`
    );

    const automatorCommand = `osascript ${__dirname}/applescript/convo.scpt "${chatTitle}" "${chatMessage}"`;

    log(`exec automator command:\n${automatorCommand}`);

    return shell.exec(
      automatorCommand,
      {
        silent: true,
      },
      finishedWithSend("NEW_CHAT")
    );
  }

  const appleScriptCommand = `osascript ${__dirname}/applescript/send.scpt "${chatMessage}" "${chatGUID}"`;

  log(`exec osascript command:\n${appleScriptCommand}`);

  return shell.exec(
    appleScriptCommand,
    {
      silent: true,
    },
    finishedWithSend("EXISTING_CHAT")
  );
};

// basic message model
var Message = function (chatTitle, chatMessage, callback) {
  this.chatTitle = chatTitle;
  this.chatMessage = chatMessage;
  this.messageCallback = callback;

  if (!callback) {
    this.messageCallback = function () {};
  }
};

/**
 * [sendMessagesFromQueue checks queue for more messages, attempts to send them if it is not already sending]
 * @return {[type]} [void]
 */
async function sendMessagesFromQueue() {
  log(`sendMessagesFromQueue`);

  if (isSending) {
    log(`already sending another message, cancelling this send`);

    didCancelSend = true;

    return;
  }

  if (messageQueue.isEmpty()) {
    log(`no messages to send`);

    return;
  }

  log(`sending message!`);

  isSending = true;

  // select the first messages that we need to send
  var message = messageQueue.dequeue();

  log(message);

  var chatTitle = message.chatTitle;
  var chatMessage = message.chatMessage;
  var messageCallback = message.messageCallback;

  log(`hand off to osascript`);

  await _osascriptSendMessageToChat(chatTitle, chatMessage, messageCallback);
}

/**
 * [sendMessage main module export]
 * @param  {[type]}   chatTitle   [phone number, email address, title of group chat]
 * @param  {[type]}   chatMessage [message to send]
 * @param  {Function} callback    [callback to execute when done sending]
 * @return {[type]}               [void]
 */
exports.sendMessage = function (chatTitle, chatMessage, callback) {
  log(`enqueue new message ${chatTitle} ${chatMessage}`);

  // add new message to the messagequeue
  messageQueue.enqueue(new Message(chatTitle, chatMessage, callback));

  log(`now attempt to send`);

  // attempt to send messages
  sendMessagesFromQueue();
};
