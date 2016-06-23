var slackbot = require('./lib/bot');

var config = {
    bot_name: "IOBot",//Provide the name to post under
    token: 'xoxp-22963160544-53818543251-53867049780-3d0b1d6350',
    alias_maps: {
      "ulna": ["illop"],
    },

    helpName: "ALIASHELP",
    verbose: true,
    emoji: ":slack:",
    link_separator: ", "// use \n if you want new lines
};

//DO NOT EDIT BELOW HERE
var slackbot = new slackbot.Bot(config);
slackbot.run();
