require("babel-core/register");
require("babel-polyfill");

const nightmare = require('nightmare')({show: true});
const cheerio = require('cheerio');
const request = require('request-promise');
const vo = require('vo');

module.exports = (spinner, statusPrefix, hashtags, excludes, interval) => {
  const cleanedTags = hashtags => {
    return hashtags.split(' ').map(t => {
      return t.indexOf('#') === 0 ? t : `#${t}`;
    });
  };

  const intervalInSeconds = interval => {
    try {
      const val = interval.split(/(?:^(\d{1,}))/gi).slice(1);
      if (val.length !== 2) {
        throw new Error()
      };
      return +val[0] * (val[1] === 'mn' ? 60 : 60 * 60);
    } catch (err) {
      return 10 * 60;
    }
  };

  const status = (statusPrefix) => {
    return function (msg) {
      return `${statusPrefix} - ${msg}`;
    }
  }

  const msg = status(statusPrefix);
  spinner.text = msg(`Searching for posts tagged "${cleanedTags(hashtags).join(', ')}" every ${interval}... starting now!`);

  const main = function * () {

  };
}
