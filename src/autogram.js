require("babel-core/register");
require("babel-polyfill");

const nightmare = require('nightmare')({
  show: true,
  webPreferences: {
    partition: 'nopersist'
  }
});
const cheerio = require('cheerio');
const request = require('request-promise');
const colors = require("colors/safe");
const vo = require('vo');

module.exports = (spinner, statusPrefix, hashtags, excludes, interval, maxScroll, username, password) => {
  const cleanedTags = hashtags => {
    return hashtags.split(' ').map(t => t);
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

  const statusMsg = text => {
    spinner.text = msg(text);
    return spinner;
  }

  let tags = cleanedTags(hashtags);

  statusMsg(`Searching for posts tagged "#${tags.join(', #')}" every ${interval}... starting now!`);

  const main = function * () {
    let currentWinHeight = 0;
    let previousWinHeight;
    let scrollIterations = 0;

    yield nightmare
      .viewport(800, 600)
      .useragent('Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36')

      // Go to Instagram's landing page.
      .goto('https://www.instagram.com')
      .wait(4000)

      // Click "sign in" to display login form.
      .click('[href="javascript:;"]')
      .wait(1000)

      // Enter credentials.
      .type('input[name="username"]', username)
      .type('input[name="password"]', password)
      .click('button')
      .wait(2000)

      // Check and stop if login fails.
      .evaluate(() => {
        return new Promise((resolve, reject) => {
          return resolve(!!document.querySelector('#slfErrorAlert'))
        })
      })
      .then(hasInvalidCredentials => {
        if (hasInvalidCredentials) {
          throw new Error('Invalid credentials!');
        }
      });

    // Explore each tags.
   // while (tags.length > 0) {
      yield nightmare
        .goto(`https://www.instagram.com/explore/tags/${tags.shift()}`)
        .wait(1000)

      // Click on "load more" below content to trigger lazy-loading
        // of content in page.
        .click('a[href*="?max_id"]')
        .wait(1000)

      // Trigger lazy load by scrolling down a few times.
      while (previousWinHeight !== currentWinHeight) {
        previousWinHeight = currentWinHeight;
        scrollIterations++;

        currentWinHeight = yield nightmare.evaluate(() => {
          return document.body.scrollHeight;
        });

        if (scrollIterations < maxScroll) {
          yield nightmare
            .scrollTo(currentWinHeight, 0)
            .wait(1000);
        }
      }


    //}
  };

  vo(main)(err => {
    if (err) {
      statusMsg(colors.red(`ERROR [${err.message}] -- Aborting session...`))
      setTimeout(() => process.exit(), 1000);
    };
  });
}
