var slackbot = require('./lib/bot');

var config = {
    bot_name: "",//Provide the name to post under
    token: 'XXXX-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX-XXXXXX',
    alias_maps: JSON.parse(fs.readFileSync('./alias_maps_example.txt','utf-8')),

    helpName: "ALIASHELP",
    verbose: true,
    emoji: ":slack:",
    link_separator: ", "// use \n if you want new lines
};

//DO NOT EDIT BELOW HERE
var slackbot = new slackbot.Bot(config);
slackbot.run();
