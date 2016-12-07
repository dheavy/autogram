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
const colors = require('colors/safe');
const _e = require('node-emoji').get;
const vo = require('vo');

module.exports = (spinner, statusPrefix, hashtags, excludes, interval, maxScroll, username, password) => {
  const randomComment = () => {
    const messages = [
      '<3', 'sweet <3', 'aaaaw', '<3 <3 <3', 'cool!', 'very nice', 'love it'
    ];
    return messages[Math.floor(Math.random() * messages.length)]
  };

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
  let excludedTagsList = excludes ? excludes.split(' ') : [];

  statusMsg(`Searching for posts tagged "#${tags.join(', #')}" every ${interval}... starting now!`);

  const main = function * () {
    let currentWinHeight = 0;
    let previousWinHeight;
    let scrollIterations = 0;

    yield nightmare
      .viewport(1024, 800)
      .useragent('Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36')

      // Go to Instagram's landing page.
      .goto('https://www.instagram.com')
      .wait('[href="javascript:;"]')

      // Click "sign in" to display login form.
      .click('[href="javascript:;"]')
      .wait('input[name="username"]')

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
      let tag = tags.shift();

      yield nightmare
        .goto(`https://www.instagram.com/explore/tags/${tag}`)
        .wait('a[href*="?max_id"]')

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

      // Content should now be ready.
      // Capture a list of hyperlinks of posts to act on.
      let posts = yield nightmare.evaluate((tag) => {
        return [].map.call(
          document.querySelectorAll(`a[href*="?tagged=${tag}"]`), elm => elm.href
        );
      }, tag);


      for (let i = 0; i < posts.length; i++) {
        let canInteract = yield nightmare
          // Go to post page.
          .goto(posts[i])

          // Wait for OP's comment to be rendered,
          // then check if I didn't leave a "like"
          // or commented it already.
          .wait('h1 span')
          .evaluate((username, excludedTagsList) => {
            const opComment = document.querySelector('h1 span').innerText;
            const tags = opComment.split(' ').filter(o => o.indexOf('#') === 0).join(' ');
            const userNames = [].map.call(
              [].filter.call(
                document.querySelectorAll('article:nth-child(1) div ul li a'),
                elm => elm.innerText.indexOf('#') === -1
              ),
              elm => elm.innerText
            );

            const hasAlreadyLiked = !!document.querySelector('.coreSpriteHeartFull')
            const hasAlreadyCommented = userNames.indexOf(username) > -1;
            const containsExcludedHashtags = excludedTagsList.filter(t => tags.indexOf(t) > -1).length;

            return hasAlreadyLiked || hasAlreadyCommented || containsExcludedHashtags;
          }, username, excludedTagsList);

        if (!canInteract) {
          let isUnavailable = yield nightmare
            // Check if content is unavailable.
            .evaluate(() => {
              return !!document.querySelector('.error-container');
            });

          if (!isUnavailable) {
            yield nightmare
              // Wait for page to be rendered.
              .wait('article div section a[href="#"]')
              .wait('form input')

              // Click on like button
              .click('article div section a[href="#"]')

              // Add random comment and press ENTER to validate.
              .type('form input', randomComment())
              .wait(2000)
              .type('form input', '\u000d')
              .wait(1000);
          }
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
