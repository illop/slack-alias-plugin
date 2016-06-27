var _ = require('underscore');
var slack = require('./slacker');
var slackbot = require('node-slackbot');
var fs = require('fs');

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
Bot.prototype.localPattern = '';
Bot.prototype.helpTxt = '';
Bot.prototype.helpList = {
    set: '*alias set [scope] <alias> <list of users>* - This command creates a new alias. The list of users should be comma-separated and unfortunately can not include the @ symbol. By default, I will only set a local alias unless the scope argument says "global".',
    unset: '*alias unset [scope] <alias>* - This command unsets an existing alias. By default, I will only unset a local alias unless the scope argument says "global".',
    get: '*alias get [scope] <alias>* - This command tells you what an alias is currently set to. If there is a local alias that shares a name with a global alias, this command will return the definition for the local alias unless the scope argument says "global".',
    update: '*alias update [scope] <alias> <list of users>* - This command updates an existing alias with a new list of users. The list of users should be comma-separated and unfortunately can not include the @ symbol. By default, I will only update a local alias unless the scope argument says "global".',
    help: "*alias help [command]* - This command tells you how I work! If a specific command is given, I will only reply with instructions for that command. For a list of existing aliases, you can type @ALIASHELP at any time.",
    scope: "_A note on scope: Local aliases are specific to this channel only. Global aliases are available to the entire company._"
};

Bot.prototype.build_pattern = function (channel) {
  var self = this,
      verbose = self.config.verbose;
  self.pattern = "(?:@)((";
  self.localPattern = "(?:@)((";
  var len_global = _.keys(self.config.alias_maps['global']).length;
  if (verbose) {
      console.log('There are ' + len_global + ' global aliases.');
  }
  var len_channel = _.keys(self.config.alias_maps[channel]).length;
  if (verbose) {
      console.log('There are ' + len_channel + ' local aliases in this channel.');
  }
  self.helpTxt = "The following global aliases are currently supported:\n\n";
  _.each(self.config.alias_maps['global'], function (value, key, obj) {
    if (self.config.alias_maps[channel][key] == undefined) {
        self.pattern += key;
        self.pattern += "|";
        self.helpTxt += '*@' + key + ":* " + value.join(", ") + "\n ";
    }
  });
  self.helpTxt += '*@' + self.config.helpName + ':* Tells you what aliases are available in this channel.\n\n';
  if (len_channel > 0) {
    self.helpTxt += "The following local aliases are currently supported in this channel:\n\n";
    _.each(self.config.alias_maps[channel], function (value, key, obj) {
      self.localPattern += key;
      if (key != _.keys(self.config.alias_maps[channel])[len_channel - 1]) {
          self.localPattern += "|";
      }
      self.helpTxt += '*@' + key + ":* " + value.join(", ") + "\n ";
    });
  } else {
    self.helpTxt += "No local aliases are currently supported in this channel."
  }
  self.pattern += self.config.helpName + "))";
  self.localPattern += "))";
  if (verbose) {
    console.log("Global pattern is: " + self.pattern);
    console.log("Local pattern is: " + self.localPattern);
  }
}

Bot.prototype.write_alias_map = function () {
    var self = this,
        verbose = self.config.verbose;
    fs.writeFile('./alias_maps_by_channel.txt', JSON.stringify(self.config.alias_maps), function(err) {
      if(err) {
        return console.log(err);
      }
      if (verbose) {
        console.log("The alias map was updated!");
      }
     });
}

Bot.prototype.run = function () {
  var self = this,
      verbose = self.config.verbose,
      bot = new slackbot(this.config.token);
  bot.use(function (message, cb) {
    if ('message' == message.type && message.text != null && message.subtype != "bot_message") {
      if (verbose) {
        console.log(message);
      }
      if (self.config.alias_maps[message.channel] == undefined) {
          self.config.alias_maps[message.channel] = {};
          self.write_alias_map();
      }
      self.build_pattern(message.channel);
      var msg = message.text.trim().toLowerCase().replace(/\s+/g,' ').replace(/\s?,\s?/g,',').split(' ');
      if (!(msg[0] == 'alias' && ['set','unset','get','update','help'].indexOf(msg[1]) >= 0)) {
        var regexp = new RegExp(self.pattern, "g"),
            localRegex = new RegExp(self.localPattern, "g"),
            match,
            requests = [],
            def;
        var msgs = [];
        while (match = regexp.exec(message.text.toLowerCase())) {
          var theMatch = match[1].trim();
          if (theMatch != self.config.helpName) {
            var expansions = self.config.alias_maps['global'][theMatch];
            if (verbose) {
              console.log("Match: ");
              console.log(match);
              console.log(expansions);
            }
            msgs.push(expansions.join(self.config.link_separator));
          } else {
            msgs.push(self.helpTxt);

          }
        }
        if (self.localPattern != '(?:@)(())') {
            while (match = localRegex.exec(message.text.toLowerCase())) {
                var theMatch = match[1].trim();
                if (theMatch != self.config.helpName) {
                    var expansions = self.config.alias_maps[message.channel][theMatch];
                    if (verbose) {
                        console.log("Match: ");
                        console.log(match);
                        console.log(expansions);
                    }
                    msgs.push(expansions.join(self.config.link_separator));
                } else {
                    msgs.push(self.helpTxt);

                }
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
        if (msg.length > 5) {
            msgs.push('Please provide a comma separated list of usernames to set this alias.');
        } else if (msg.length < 4) {
            msgs.push("Please provide a comma separated list of usernames to set to this alias.");
        } else if (msg.length == 4 && (msg[2].indexOf('<') >= 0 || msg[2].indexOf('>') >= 0)) {
            msgs.push("Sorry, this is already someone's username!");
        } else if (msg.length == 5 && ['local','global'].indexOf(msg[2]) == -1) {
            msgs.push("Sorry, but I'm not sure what you asked me to do! If you meant to enter a scope, please make sure you enter either " + '"local" or "global". If you tried to set multiple users to a single alias, please make sure you enter them as a comma separated list.');
        } else if (msg.length == 5 && (msg[3].indexOf('<') >= 0 || msg[3].indexOf('>') >= 0)) {
            msgs.push("Sorry, this is already someone's username!");
        } else if (msg.length == 4 && (msg[3].indexOf('<') >= 0 || msg[3].indexOf('>') >= 0)) {
            msgs.push('Please do not include the @ symbol in the list of usernames you wish to alias.');
        } else if (msg.length == 5 && (msg[4].indexOf('<') >= 0 || msg[4].indexOf('>') >= 0)) {
            msgs.push('Please do not include the @ symbol in the list of usernames you wish to alias.');
        } else if (msg.length == 4) {
            var userlist = msg[3].split(',');
            for (i = 0; i < userlist.length; i++) {
                userlist[i] = '@'+userlist[i];
            }
            if (self.config.alias_maps['global'][msg[2].replace('@','')] == undefined && self.config.alias_maps[message.channel][msg[2]] == undefined) {
                self.config.alias_maps[message.channel][msg[2].replace('@','')] = userlist;
                msgs.push('Alias set! Local alias @' + msg[2].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator) + '.');
                self.write_alias_map();
            } else if (self.config.alias_maps[message.channel][msg[2].replace('@','')] != undefined) {
                msgs.push('Sorry, this local alias is already taken!');
            } else if (self.config.alias_maps[message.channel][msg[2].replace('@','')] == undefined && self.config.alias_maps['global'][msg[2].replace('@','')] != undefined){
                self.config.alias_maps[message.channel][msg[2].replace('@','')] = userlist;
                msgs.push('Alias set! Local alias @' + msg[2].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator) + '. In this channel, this will now override the global alias of the same name.');
                self.write_alias_map();
            } else {
                self.config.alias_maps[message.channel][msg[2].replace('@','')] = userlist;
                msgs.push('Alias set! Local alias @' + msg[2].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator) + '.');
                self.write_alias_map();
            }
        } else {
            var scope = msg[2];
            var userlist = msg[3].split(',');
            for (i = 0; i < userlist.length; i++) {
                userlist[i] = '@'+userlist[i];
            }
            if (scope == 'global') {
                if (self.config.alias_maps['global'][msg[3].replace('@','')] == undefined) {
                    self.config.alias_maps['global'][msg[3].replace('@','')] = userlist;
                    msgs.push('Alias set! Global alias @' + msg[3].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator) + '.');
                    self.write_alias_map();
                } else {
                    msgs.push('Sorry, this global alias is already taken!')
                }
            } else if (scope == 'local') {
                if (self.config.alias_maps[message.channel][msg[3].replace('@','')] == undefined) {
                    self.config.alias_maps[message.channel][msg[3].replace('@','')] = userlist;
                    if (self.config.alias_maps['global'][msg[3].replace('@','')] == undefined) {
                        msgs.push('Alias set! Local alias @' + msg[3].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator) + '.');
                    } else {
                        msgs.push('Alias set! Local alias @' + msg[3].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator) + '. In this channel, this will now override the global alias of the same name.');
                    }
                    self.write_alias_map();
                } else {
                    msgs.push('Sorry, this local alias is already taken!')
                }
            }
        }
      } else if (msg[0] == 'alias' && msg[1] == 'unset') {
          console.log(msg);
          if (msg.length > 4) {
              msgs.push('Please do not include anything after the alias you wish to unset.');
          } else if (msg.length < 3) {
              msgs.push('Please specify which alias to unset.');
          } else if (msg.length == 3 && (msg[2].indexOf('<') >= 0 || msg[2].indexOf('>') >= 0)) {
              msgs.push('Sorry, this is not a custom alias!');
          } else if (msg.length == 4 && (msg[3].indexOf('<') >= 0 || msg[3].indexOf('>') >= 0)) {
              msgs.push('Sorry, this is not a custom alias!');
          } else if (msg.length == 4 && ['global','local'].indexOf(msg[2]) == -1) {
              msgs.push("Sorry, but I'm not sure what you asked me to do! If you meant to enter a scope, please make sure you enter either " + '"local" or "global". If you tried to unset multiple aliases, please enter only one at a time.');
          } else if (msg.length == 3) {
              var userlist = msg[2].replace('@','').split(',');
              if (userlist.length > 1) {
                  msgs.push("Sorry, I can only unset one alias at a time!");
              } else if (self.config.alias_maps[message.channel][userlist[0]] == undefined) {
                  msgs.push("Sorry, this local alias does not exist!")
              } else {
                  delete self.config.alias_maps[message.channel][userlist[0]];
                  self.write_alias_map();
                  msgs.push("Local alias @" + userlist[0] + " unset!");
              }
          } else {
              var scope = msg[2];
              var userlist = msg[3].replace('@','').split(',');
              if (userlist.length >1) {
                  msgs.push("Sorry, I can only unset one alias at a time!");
              } else if (scope == 'global') {
                  if (self.config.alias_maps['global'][userlist[0]] == undefined) {
                      msgs.push("Sorry, this global alias doesn't exist.");
                  } else {
                      delete self.config.alias_maps['global'][userlist[0]];
                      self.write_alias_map();
                      msgs.push("Global alias @" + userlist[0] + " unset!");
                  }
              } else if (scope == 'local') {
                  if (self.config.alias_maps[message.channel][userlist[0]] == undefined) {
                      msgs.push("Sorry, this local alias doesn't exist.");
                  } else {
                      delete self.config.alias_maps[message.channel][userlist[0]];
                      self.write_alias_map();
                      msgs.push("Local alias @" + userlist[0] + " unset!");
                  }
              }
          }
      } else if (msg[0] == 'alias' && msg[1] == 'update') {
          if (msg.length > 5) {
              msgs.push('Please provide a comma separated list of usernames to update this alias.');
          } else if (msg.length == 4 && self.config.alias_maps['global'][msg[2]] == undefined && self.config.alias_maps[message.channel][msg[2]] == undefined) {
              msgs.push("Sorry, this alias does not exist.");
          } else if (msg.length == 5 && ['local','global'].indexOf(msg[2]) == -1) {
              msgs.push("Sorry, but I'm not sure what you asked me to do! If you meant to enter a scope, please make sure you enter either " + '"local" or "global". If you tried to set multiple users to a single alias, please make sure you enter them as a comma separated list.');
          } else if (msg.length > 4 && !(self.config.alias_maps['global'][msg[2]] == undefined && self.config.alias_maps[message.channel][msg[2]] == undefined)) {
              msgs.push("Please provide a comma separated list of usernames to update this alias.");
          } else if (msg.length == 4 && (msg[2].indexOf('<') >= 0 || msg[2].indexOf('>') >= 0)) {
              msgs.push('Sorry, this is not a custom alias.');
          } else if (msg.length == 5 && (msg[3].indexOf('<') >= 0 || msg[3].indexOf('>') >= 0)) {
              msgs.push('Sorry, this is not a custom alias.');
          } else if (msg.length == 4 && (msg[3].indexOf('<') >= 0 || msg[3].indexOf('>') >= 0)) {
              msgs.push('Please do not include the @ symbol in the list of usernames you wish to alias.');
          } else if (msg.length == 5 && (msg[4].indexOf('<') >= 0 || msg[4].indexOf('>') >= 0)) {
              msgs.push('Please do not include the @ symbol in the list of usernames you wish to alias.');
          } else if (msg.length == 4) {
              if (self.config.alias_maps[message.channel][msg[2]] != undefined) {
                  var userlist = msg[3].split(',');
                  for (i = 0; i < userlist.length; i++) {
                      userlist[i] = '@'+userlist[i];
                  }
                  self.config.alias_maps[message.channel][msg[2].replace('@','')] = userlist;
                  msgs.push('Alias updated! Local alias @' + msg[2].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator) + '.');
                  self.write_alias_map();
              } else {
                  msgs.push('Sorry, this local alias does not exist.');
              }
              if (verbose) {
                  console.log(self.config.alias_maps);
              }
          } else {
              var scope = msg[2];
              if (scope == 'global') {
                  if (self.config.alias_maps['global'][msg[3]] != undefined) {
                      var userlist = msg[4].split(',');
                      for (i = 0; i < userlist.length; i++) {
                          userlist[i] = '@'+userlist[i];
                      }
                      self.config.alias_maps['global'][msg[3].replace('@','')] = userlist;
                      msgs.push('Alias updated! Global alias @' + msg[3].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator) + '.');
                      self.write_alias_map();
                  } else {
                      msgs.push('Sorry, this global alias does not exist.');
                  }
              } else {
                  if (self.config.alias_maps[message.channel][msg[3]] != undefined) {
                      var userlist = msg[4].split(',');
                      for (i = 0; i < userlist.length; i++) {
                          userlist[i] = '@'+userlist[i];
                      }
                      self.config.alias_maps[message.channel][msg[3].replace('@','')] = userlist;
                      msgs.push('Alias updated! Local alias @' + msg[3].replace('@','') + ' has been set to ' + userlist.join(self.config.link_separator) + '.');
                      self.write_alias_map();
                  } else {
                      msgs.push('Sorry, this local alias does not exist.');
                  }
              }
          }
      } else if (msg[0] == 'alias' && msg[1] == 'get') {
          console.log(msg);
          if (msg.length > 4) {
              msgs.push('Please do not include anything after the name of the alias you wish to see.');
          } else if (msg.length < 3) {
              msgs.push('Please specify which alias to get.');
          } else if (msg.length == 3 && (msg[2].indexOf('<') >= 0 || msg[2].indexOf('>') >= 0)) {
              msgs.push('Sorry, this is not a custom alias!');
          } else if (msg.length == 4 && (msg[3].indexOf('<') >= 0 || msg[3].indexOf('>') >= 0)) {
              msgs.push('Sorry, this is not a custom alias!');
          } else if (msg.length == 4 && ['global','local'].indexOf(msg[2]) == -1) {
              msgs.push("Sorry, but I'm not sure what you asked me to do! If you meant to enter a scope, please make sure you enter either " + '"local" or "global". If you tried to get multiple aliases, please enter only one at a time.');
          } else if (msg.length == 3) {
              var userlist = msg[2].replace('@','').split(',');
              if (userlist.length > 1) {
                  msgs.push('Sorry, I can only get one alias at a time!');
              } else if (self.config.alias_maps['global'][userlist[0]] == undefined && self.config.alias_maps[message.channel][userlist[0]] == undefined) {
                  msgs.push("Sorry, this alias doesn't exist.");
              } else if (self.config.alias_maps[message.channel][userlist[0]] == undefined) {
                  msgs.push('Global alias @' + userlist[0] + ' is currently set to ' + self.config.alias_maps['global'][userlist[0]].join(self.config.link_separator) + '.');
              } else {
                  msgs.push('Local alias @' + userlist[0] + ' is currently set to ' + self.config.alias_maps[message.channel][userlist[0]].join(self.config.link_separator) + ' for this channel.');
              }
          } else if (msg.length == 4) {
              var scope = msg[2];
              var userlist = msg[3].replace('@','').split(',');
              if (userlist.length > 1) {
                  msgs.push('Sorry, I can only get one alias at a time!');
              } else if (scope == 'global') {
                  if (self.config.alias_maps['global'][userlist[0]] == undefined) {
                      msgs.push("Sorry, this global alias doesn't exist.");
                  } else {
                      msgs.push('Global alias @' + userlist[0] + ' is currently set to ' + self.config.alias_maps['global'][userlist[0]].join(self.config.link_separator) + '.');
                  }
              } else {
                  if (self.config.alias_maps[message.channel][userlist[0]] == undefined) {
                      msgs.push("Sorry, this local alias doesn't exist.");
                  } else {
                      msgs.push('Local alias @' + userlist[0] + ' is currently set to ' + self.config.alias_maps[message.channel][userlist[0]].join(self.config.link_separator) + '.');
                  }
              }
          }
      } else if (msg[0] == 'alias' && msg[1] == 'help') {
          if (msg.length == 2) {
              var helpString = 'The following commands are currently available:\n\n';
              var keys = Object.keys(self.helpList);
              for (var i in keys) {
                  helpString += self.helpList[keys[i]] + '\n';
                  if (keys[i] == 'help') {
                      helpString += '\n'
                  }

              }
              if (verbose) {
                  console.log(self.helpList);
                  console.log(Object.keys(self.helpList));
              }
              helpString += '\n';
              helpString += self.helpTxt;
              msgs.push(helpString);
          } else if (msg.length > 3) {
              msgs.push("Sorry, I'm not sure what you need help with! Please specify a command, or say \"alias help\" to see everything I can do.");
          } else if (msg.length == 3) {
              if (self.helpList[msg[2]] == undefined) {
                  msgs.push('Sorry, "' + msg[2] +'" is not a valid command.');
              } else {
                  msgs.push(self.helpList[msg[2]]);
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
