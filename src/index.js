const { resolve } = require('path')
require('dotenv').config({ path: resolve(__dirname, '../', process.env.NODE_ENV === 'production' ? '.env.production' : '.env') })
const express = require('express')
const puppeteer = require(process.env.NODE_ENV === 'production' ? 'puppeteer' : 'puppeteer-core')
const mergeImg = require('merge-img')
const compression = require('compression')
const Jimp = require('jimp')
const app = express()
app.use(compression())
app.use(require('body-parser').json({
  limit: '10mb'
}));
(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.NODE_ENV === 'production' ? undefined : process.env.CHROMIUM_PATH,
    headless: true
  });
  app.post('/page', async (req, res) => {
    try {
      const page = await browser.newPage();
      const url = req.body.url
      await page.setViewport({
        width: 1280,
        height: 720
      })
      await page.goto(url, { waitUntil: "networkidle2" })

      let r = await page.screenshot({ type: 'jpeg', encoding: 'binary' });
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
  app.post('/', async (req, res) => {
    let width = ~~req.body.width || 500
    let height = ~~req.body.height || 1000
    try {
      const page = await browser.newPage();
      await page.setViewport({
        width,
        height
      })
      let content = `<link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+HK&family=Noto+Sans+JP&family=Noto+Sans+KR&family=Noto+Sans+SC&family=Noto+Sans+TC&display=swap" rel="stylesheet"><style>html body {
        margin-top: 0px !important;
        font-family: 'Noto Sans SC', sans-serif;
    }
    
    :lang(ko) {
        font-family: 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans HK', 'Noto Sans TC', 'Noto Sans SC', sans-serif;
    }
    
    :lang(ja) {
        font-family: 'Noto Sans JP', 'Noto Sans HK', 'Noto Sans TC', 'Noto Sans SC', 'Noto Sans KR', sans-serif;
    }
    
    :lang(zh-TW) {
        font-family: 'Noto Sans HK', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans KR', sans-serif;
    }
    
    :lang(zh-HK) {
        font-family: 'Noto Sans HK', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans KR', sans-serif;
    }
    
    :lang(zh-Hans), :lang(zh-CN), :lang(zh) {
        font-family:  'Noto Sans SC', 'Noto Sans HK', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans KR', sans-serif;
    }
    
    div.infobox div.notaninfobox{
        width: 100%!important;
        float: none!important;
        margin: 0 0 0 0!important;
    }
    
    table.infobox, table.infoboxSpecial, table.moe-infobox {
        width: 100%!important;
        float: unset!important;
        margin: 0 0 0 0!important;
    }</style>
    <meta charset="UTF-8">
    <body>
    ${req.body.content}
    </body>`
      await page.setContent(content, { waitUntil: 'networkidle0' });
      const el = await page.$('body > *:not(script):not(style):not(link):not(meta)')
      const contentSize = await el.boundingBox()
      const dpr = page.viewport().deviceScaleFactor || 1;
      const maxScreenshotHeight = Math.floor(8 * 1024 / dpr)
      const images = []
      // https://bugs.chromium.org/p/chromium/issues/detail?id=770769
      let total_content_height = contentSize.y
      for (let ypos = contentSize.y; ypos < contentSize.height + contentSize.y; ypos += maxScreenshotHeight) {
        total_content_height += maxScreenshotHeight
        let content_height = maxScreenshotHeight
        if (total_content_height > contentSize.height + contentSize.y) {
          content_height = contentSize.height - total_content_height + maxScreenshotHeight + contentSize.y
        }
        let r = await el.screenshot({
          type: 'jpeg', encoding: 'binary', clip: {
            x: contentSize.x,
            y: ypos,
            width: contentSize.width,
            height: content_height
          }
        });
        images.push(r)
      }

      let result = await mergeImg(images, { direction: true })
      let read = await new Promise((resolve) => {
        result.getBuffer(Jimp.MIME_JPEG, (err, buf) => resolve(buf))
      })
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': read.length
      });
      res.end(read)
      await page.close()
    } catch (e) {
      res.status(500).json({
        message: e.message,
        stack: e.stack
      })
    }

  })
  app.post('/element_screenshot', async (req, res) => {
    let width = ~~req.body.width || 720
    let height = ~~req.body.height || 1280
    let element = req.body.element
    let content = req.body.content
    let url = req.body.url
    try {
      const page = await browser.newPage();
      await page.setViewport({
        width,
        height
      })
      if (content) {
        await page.setContent(content, { waitUntil: 'networkidle0' });
      } else if (url) {
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36')
        await page.goto(url, { waitUntil: "networkidle0" })
      } else {
        res.status(500).json({
          message: 'A url or content must be specified.'
        })
        return
      }

      const el = await page.$(element)
      page.addStyleTag({ 'content': `${element} {z-index: 99999999999999999999999999999}` })
      const contentSize = await el.boundingBox()
      const dpr = page.viewport().deviceScaleFactor || 1;
      const maxScreenshotHeight = Math.floor(8 * 1024 / dpr)
      const images = []
      // https://bugs.chromium.org/p/chromium/issues/detail?id=770769
      let total_content_height = contentSize.y
      for (let ypos = contentSize.y; ypos < contentSize.height + contentSize.y; ypos += maxScreenshotHeight) {
        total_content_height += maxScreenshotHeight
        let content_height = maxScreenshotHeight
        if (total_content_height > contentSize.height + contentSize.y) {
          content_height = contentSize.height - total_content_height + maxScreenshotHeight + contentSize.y
        }
        let r = await el.screenshot({
          type: 'jpeg', encoding: 'binary', clip: {
            x: contentSize.x,
            y: ypos,
            width: contentSize.width,
            height: content_height
          }
        });
        images.push(r)
      }


      let result = await mergeImg(images, { direction: true })
      let read = await new Promise((resolve) => {
        result.getBuffer(Jimp.MIME_JPEG, (err, buf) => resolve(buf))
      })
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': read.length
      });
      res.end(read)
      await page.close()

    } catch (e) {
      res.status(500).json({
        message: e.message,
        stack: e.stack
      })
    }
  })
  app.post('/section_screenshot', async (req, res) => {
    let width = ~~req.body.width || 1080
    let height = ~~req.body.height || 1920
    let section = req.body.section
    let content = req.body.content
    let url = req.body.url
    console.log(req.body)
    try {
      const page = await browser.newPage();
      await page.setViewport({
        width,
        height
      })
      if (content) {
        await page.setContent(content, { waitUntil: 'networkidle0' });
      } else if (url) {
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36')
        await page.goto(url, { waitUntil: "networkidle0" })
      } else {
        res.status(500).json({
          message: 'A url or content must be specified.'
        })
        return
      }
      
      await page.evaluate((section) => {
        const levels = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']
        const sec = document.getElementById(section).parentNode
        const sec_level = sec.tagName 
        const nbox = document.createElement('div')
        nbox.className = 'bot-sectionbox'
        nbox.style = 'display: inline-block; padding: 15px'
        nbox.appendChild(sec.cloneNode(true))
        let next_sibling = sec.nextSibling
        while(true){
          if (next_sibling == null){
            break
          }
          if (levels.includes(next_sibling.tagName)){
            if (levels.indexOf(next_sibling.tagName) <= levels.indexOf(sec_level)){
              break
            }
          }
          nbox.appendChild(next_sibling.cloneNode(true))
          next_sibling = next_sibling.nextSibling
        }
        const lazyimg = nbox.querySelectorAll(".lazyload")
        for (var i = 0; i < lazyimg.length; i++){
            lazyimg[i].className = 'image'
            lazyimg[i].src = lazyimg[i].getAttribute('data-src')
        }
        sec.parentNode.appendChild(nbox)
      }, section)

      const el = await page.$('.bot-sectionbox')
      page.addStyleTag({ 'content': `.bot-sectionbox {z-index: 99999999999999999999999999999}` })
      const contentSize = await el.boundingBox()
    
      const dpr = page.viewport().deviceScaleFactor || 1;
      const maxScreenshotHeight = Math.floor(8 * 1024 / dpr)
      const images = []
      // https://bugs.chromium.org/p/chromium/issues/detail?id=770769
      let total_content_height = contentSize.y
      for (let ypos = contentSize.y; ypos < contentSize.height + contentSize.y; ypos += maxScreenshotHeight) {
        total_content_height += maxScreenshotHeight
        let content_height = maxScreenshotHeight
        if (total_content_height > contentSize.height + contentSize.y) {
          content_height = contentSize.height - total_content_height + maxScreenshotHeight + contentSize.y
        }
        let r = await el.screenshot({
          type: 'jpeg', encoding: 'binary', clip: {
            x: contentSize.x,
            y: ypos,
            width: contentSize.width,
            height: content_height
          }
        });
        images.push(r)
      }


      let result = await mergeImg(images, { direction: true })
      let read = await new Promise((resolve) => {
        result.getBuffer(Jimp.MIME_JPEG, (err, buf) => resolve(buf))
      })
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': read.length
      });
      res.end(read)
      await page.close()

    } catch (e) {
      res.status(500).json({
        message: e.message,
        stack: e.stack
      })
    }
  })
  app.get('/source', async (req, res) => {
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36')
      const url = req.query.url
      await page.setViewport({
        width: 1280,
        height: 720
      })
      const r = await page.goto(url, { waitUntil: "networkidle2" })
      if (r.headers()['content-type']) {
        res.setHeader('content-type', r.headers()['content-type'])
      }
      res.send(await r.buffer())
    } catch (e) {
      res.status(500).json({
        message: e.message,
        stack: e.stack
      })
    }
  })
  const server = app.listen(~~process.env.FC_SERVER_PORT || 15551)
  server.timeout = 0
  server.keepAliveTimeout = 0
})()
