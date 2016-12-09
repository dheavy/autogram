require("babel-core/register");
require("babel-polyfill");

const cheerio = require('cheerio');
const request = require('request-promise');
const colors = require('colors/safe');
const vo = require('vo');

/**
 * Run Autogram bot.
 *
 * @param  {object} params      Contains hashtags, excludes, comments, separator, isShown, maxScrolls parameters.
 * @param  {object} credentials User's instagram username and password.
 * @param  {object} utils       Includes log related objects, if used in CLI mode.
 * @return {object} Autogram module.
 */
module.exports = (params, credentials, utils) => {
  const nightmare = require('nightmare')({
    show: params.isShown,
    webPreferences: {
      partition: 'nopersist'
    }
  });

  /**
   * Pull a random canned comment.
   *
   * @param  {string} comments  Set of comments to include, separated by `separator`.
   * @param  {string} separator Separator string used to split comment string into an array.
   * @return {string} A random comment from the list.
   */
  const randomComment = (comments, separator) => {
    let messages = ['great'];

    if (comments && comments.trim() !== '') {
      messages = messages.concat(comments.split(separator));
    }

    return messages[Math.floor(Math.random() * messages.length)]
  };

  /**
   * Clean string of set of hashtags passed as arguments.
   * Possibly removing pound sign if included.
   *
   * @param  {string} hashtags A set of hashtags separated by a space.
   * @return {array}  Array of hashtag to scan for.
   */
  const cleanedTags = hashtags => {
    return hashtags.split(' ').map(t => t.indexOf('#') === 0 ? t.substring(1) : t);
  };

  /**
   * [description]
   * @param  {[type]} text [description]
   * @return {[type]}      [description]
   */
  const statusMsg = text => {
    if (!utils.spinner && !utils.statusPrefix) return;
    utils.spinner.text = (prefix => msg => `${prefix} - ${msg}`)(utils.statusPrefix)(text);
    return utils.spinner;
  }

  // Create usable lists of tags to use and to exclude.
  let tags = cleanedTags(params.hashtags);
  let excludedTagsList = params.excludes ? params.excludes.split(' ') : [];

  statusMsg(`Searching for posts tagged "#${tags.join(', #')}"`);

  /**
   * Generator running the scraping and interaction process.
   *
   * @yield {mixed}
   */
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
      .type('input[name="username"]', credentials.username)
      .type('input[name="password"]', credentials.password)
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
    // TODO: Not working for several tags - refactor me.
    while (tags.length > 0) {
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

        if (scrollIterations < params.maxScrolls) {
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
          }, credentials.username, excludedTagsList);

        if (!canInteract) {
          let isUnavailable = yield nightmare
            // Check if content is unavailable.
            .evaluate(() => {
              return !!document.querySelector('.dialog-404');
            });

          if (!isUnavailable) {
            yield nightmare
              // Wait for page to be rendered.
              .wait('form input')

              // Click on like button
              .click('article div section a[href="#"]')

              // Add random comment and press ENTER to validate.
              .type('form input', randomComment(params.comments, params.separator))
              .wait(2000)
              .type('form input', '\u000d')
              .wait(1000);
          }
        }
      }
    }

    yield nightmare.end();
    return process.exit();
  };

  vo(main)(err => {
    if (err) {
      statusMsg(colors.red(`ERROR [${err.message}] -- Aborting session...`))
      setTimeout(() => process.exit(), 1000);
    };
  });
}
