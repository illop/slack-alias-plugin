var _ = require('underscore');
var slack = require('./slacker');
var slackbot = require('node-slackbot');

/**
 * Slackbot to expand custom aliases.
 * TO DO: Add function for users to create new aliases.
 */
var Bot = function (config) {
  var self = this;
  this.config = _.defaults(config, {
    bot_name: "AliasBot",
    emoji: ":slack:",
    helpName: "ALIASHELP",
    post: true
  });

  this.slacker = new slack.Slacker({
    token: this.config.token
  });
  return this;
};

Bot.prototype.pattern = '';
Bot.prototype.helpTxt = '';

Bot.prototype.build_pattern = function () {
  var self = this,
      verbose = self.config.verbose;
  self.pattern = "(?:@)((";
  var len = _.keys(self.config.alias_maps).length;
  console.log(len);
  self.helpTxt = "The following aliases are supported: \n";
  _.each(self.config.alias_maps, function (value, key, obj) {
    self.pattern += key;
    self.pattern += "|";
    self.helpTxt += key + "\n\t[" + value.join(", ") + "]\n ";
  });
  self.pattern += self.config.helpName + "))";
  self.helpTxt += self.config.helpName;
  if (verbose) {
    console.log("Pattern is: " + self.pattern);
  }
};

Bot.prototype.run = function () {
  var self = this,
      verbose = self.config.verbose,
      bot = new slackbot(this.config.token);
  self.build_pattern();
  bot.use(function (message, cb) {
    if ('message' == message.type && message.text != null && message.subtype != "bot_message") {
      if (verbose) {
        console.log(message);
      }
      var msg = message.text.trim().toLowerCase().replace(/\s+/g,' ').replace(/\s?,\s?/g,',').split(' ');
      if (!(msg[0] == 'alias' && (msg[1] == 'set' || msg[1] == 'unset'))) {
        var regexp = new RegExp(self.pattern, "g"),
            match,
            requests = [],
            def;
        var msgs = [];
        while (match = regexp.exec(message.text)) {
          var theMatch = match[1].trim();
          if (theMatch != self.config.helpName) {
            var expansions = self.config.alias_maps[theMatch];
            if (verbose) {
              console.log("Match: ");
              console.log(match);
              console.log(expansions);
            }
            msgs.push(expansions.join(self.config.link_separator));
          } else {
            msgs.push(helpTxt);

          }
        }
        if (msgs.length > 0){
          self.slacker.send('chat.postMessage', {
              channel: message.channel,
              parse: "all",
              text: "^ " + msgs.join(self.config.link_separator),
              username: self.config.bot_name,
              unfurl_links: false,
              link_names: 1,
              icon_emoji: self.config.emoji
          });
        }

    }
    cb();
    }
  });
  bot.use(function (message, cb) {
    if ('message' == message.type && message.text != null && message.subtype != "bot_message") {
      if (verbose) {
        console.log(message);
      }
      var msg = message.text.trim().toLowerCase().replace(/\s+/g,' ').replace(/\s?,\s?/g,',').split(' ');
      console.log(msg);
      var msgs = [];
      if (msg[0] == 'alias' && msg[1] == 'set') {
        if (msg.length > 4) {
            msgs.push('Please provide a comma separated list of usernames to save this alias.');
        } else if (msg.length < 4) {
            msgs.push("I'm sorry, I didn't understand your request!");
        } else if (msg[2].indexOf('<') >= 0 || msg[2].indexOf('>') >= 0 || self.config.alias_maps[msg[2].replace('@','')]) {
            msgs.push('Sorry, this alias is already taken!');
        } else if (msg[3].indexOf('<') >= 0 || msg[3].indexOf('>') >= 0) {
            msgs.push('Please do not include the @ symbol in the list of usernames you wish to alias.');
        } else {
            var userlist = msg[3].split(',');
            for (i = 0; i < userlist.length; i++) {
                userlist[i] = '@'+userlist[i];
            }
            self.config.alias_maps[msg[2].replace('@','')] = userlist;
            msgs.push('Alias created! @' + msg[2].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator));
            self.build_pattern();
            if (verbose) {
                console.log(self.config.alias_maps);
            }
        }
      }
      if (msg[0] == 'alias' && msg[1] == 'unset') {
          console.log(msg);
          if (msg.length > 3) {
              msgs.push('Please do not include anything after the list of aliases you wish to unset. If your message contained a list, please make sure it is comma-separated.');
          } else if (msg.length < 3) {
              msgs.push('Please specify which alias to unset.')
          } else if (msg[2].indexOf('<') >= 0 || msg[2].indexOf('>') >= 0) {
              msgs.push('Sorry, this is not a custom alias!');
          } else {
              userlist = msg[2].replace('@','').split(',');
              bad_users = [];
              for (i = 0; i < userlist.length; i++) {
                  if (self.config.alias_maps[userlist[i]] == undefined) {
                      bad_users.push('@'+userlist[i]);
                  }
              }
              if (bad_users.length == 1 && userlist.length == 1) {
                  msgs.push("Sorry, I couldn't unset this alias because " + bad_users.join(self.config.link_separator) + " does not exist!");
              } else if (bad_users.length == 1 && userlist.length > 1) {
                  msgs.push("Sorry, I didn't unset these aliases because " + bad_users.join(self.config.link_separator) + " does not exist!");
              } else if (bad_users.length > 1) {
                  msgs.push("Sorry, I didn't unset these aliases because " + bad_users.join(self.config.link_separator) + " do not exist!");
              } else {
                  for (i = 0; i < userlist.length; i++) {
                      delete self.config.alias_maps[userlist[i]];
                  }
                  self.build_pattern();
                  if (userlist.length == 1) {
                      msgs.push("Alias deleted!")
                  } else {
                      msgs.push("Aliases deleted!")
                  }
              }
          }
      }
      if (msgs.length > 0) {
        self.slacker.send('chat.postMessage', {
          channel: message.channel,
          parse: "all",
          text: "^ " + msgs.join(self.config.link_separator),
          username: self.config.bot_name,
          unfurl_links: false,
          link_names: 1,
          icon_emoji: self.config.emoji
        });
      }
    cb();
    }
  });
  bot.connect();
};

exports = module.exports.Bot = Bot;
