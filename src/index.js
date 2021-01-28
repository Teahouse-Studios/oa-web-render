require('dotenv').config()
const express = require('express')

const puppeteer = require('puppeteer-core')

const app = express()
app.use(require('body-parser').json());
(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROMIUM_PATH,
    headless: true
  });
  app.post('/', async (req, res) => {
    try {
      const page = await browser.newPage();
      await page.setViewport({
        width: 500,
        height: 1000
      })
      let content = `<style>html body {
        margin-top: 0px !important;
    }
    
    div.infobox div.notaninfobox{
        width: 100%!important;
        float: none!important;
        margin: 0 0 0 0!important;
    }
    
    table.infobox {
        width: 100%!important;
        float: unset!important;
        margin: 0 0 0 0!important;
    }</style>
    <meta charset="UTF-8">
    <body>
    ${req.body.content}
    </body>`
      // chromium is strong enough to render the weird "html"
      // lol
      await page.setContent(content, { waitUntil: 'networkidle0' });
      const el = await page.$('body > *:not(script):not(style):not(link):not(meta)')
      let r = await el.screenshot({ type: 'jpeg', encoding: 'binary' });
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': r.length
      });
      res.end(r);
      await page.close()
    } catch (e) {
      res.status(500).json({
        message: e.message,
        stack: e.stack
      })
    }
  })
  app.listen(15551, () => {
    console.log('start listening', new Date().valueOf())
  })
})()