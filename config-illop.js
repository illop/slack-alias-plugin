var slackbot = require('./lib/bot');

var config = {
    bot_name: "DickButt",//Provide the name to post under
    token: 'xoxb-53880936535-IDsRY9NX7GomHcId4C3jXlos',
    alias_maps: {
      "ulna": ["@illop"],
      "croncho": ["@trevelyan"]
    },

    helpName: "ALIASHELP",
    verbose: true,
    emoji: ":dickbutt:",
    link_separator: ", "// use \n if you want new lines
};

//DO NOT EDIT BELOW HERE
var slackbot = new slackbot.Bot(config);
slackbot.run();
