var slackbot = require('./lib/bot');

var config = {
    bot_name: "Alias Botschild",//Provide the name to post under
    token: 'xoxb-53880936535-IDsRY9NX7GomHcId4C3jXlos',
    alias_maps: {
      "ulna": ["@illop"],
      "croncho": ["@trevelyan"]
    },

    helpName: "ALIASHELP",
    verbose: true,
    emoji: ":indeed:",
    link_separator: ", "// use \n if you want new lines
};

//DO NOT EDIT BELOW HERE
var slackbot = new slackbot.Bot(config);
slackbot.run();
