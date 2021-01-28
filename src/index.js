require('dotenv').config()
const express = require('express')

const puppeteer = require('puppeteer-core')

const app = express()
app.use(require('body-parser').json())

app.get('/test', async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.CHROMIUM_PATH,
      headless: true
    });
    const page = await browser.newPage();
    await page.goto('https://example.com');
    let r = await page.screenshot({ type: 'jpeg', encoding: 'binary' });
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': r.length
    });
    res.end(r);
    await browser.close();
  } catch (e) {
    res.status(500).json({
      message: e.message,
      stack: e.stack
    })
  }
})

app.listen(15551)