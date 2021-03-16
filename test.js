
var imessage = require("./index.js");

imessage.sendMessage("", "testing imessage bot", function(response, error) {
	console.log(response);
	console.log(error);
});


// imessage.sendMessage("to group chat", "imessage module unit test - can send message with emojis🤷‍♀️\nand new lines", function() {
// 	console.log("should be fine 2");
// });

// imessage.sendMessage("direct to an email", "test 3", function() {
// 	console.log("should be fine 3");
// });
