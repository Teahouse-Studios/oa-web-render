const { resolve } = require('path')
require('dotenv').config({ path: resolve(__dirname, '../.env') })
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
    const page = await browser.newPage();
    try {
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
    } catch (e) {
      res.status(500).json({
        message: e.message,
        stack: e.stack
      })
    } finally {
      await page.close()
    }
  })
  app.post('/', async (req, res) => {
    let width = ~~req.body.width || 500
    let height = ~~req.body.height || 1000
    const page = await browser.newPage();
    try {
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
          type: 'jpeg', quality: 90, encoding: 'binary', clip: {
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
    } catch (e) {
      res.status(500).json({
        message: e.message,
        stack: e.stack
      })
    } finally {
      await page.close()
    }

  })
  app.post('/element_screenshot', async (req, res) => {
    let width = ~~req.body.width || 720
    let height = ~~req.body.height || 1280
    let element = req.body.element
    let content = req.body.content
    let url = req.body.url
    const page = await browser.newPage();
    try {
      await page.setViewport({
        width,
        height
      })
      if (content) {
        await page.setContent(content, { waitUntil: 'networkidle2' });
      } else if (url) {
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36')
        await page.goto(url, { waitUntil: "networkidle2" })
      } else {
        res.status(500).json({
          message: 'A url or content must be specified.'
        })
        return
      }

      await page.evaluate(() => {
        const lazyimg = document.querySelectorAll(".lazyload")
        for (var i = 0; i < lazyimg.length; i++){
            lazyimg[i].className = 'image'
            lazyimg[i].src = lazyimg[i].getAttribute('data-src')
        }
        const animated = document.querySelectorAll(".animated")
        for (var i = 0; i < animated.length; i++){
          animated[i].className = 'nolongeranimatebaka'
        }
        const sitenotice = document.querySelector('.sitenotice--visible') // :rina:
        if (sitenotice != null){
          sitenotice.style = 'display: none'}
        const top_ads = document.querySelector('.top-ads-container') // :rina: :rina:
        if (top_ads != null){
          top_ads.style = 'display: none'}
        document.querySelectorAll('*').forEach(element => {
          element.parentNode.replaceChild(element.cloneNode(true), element);
        });
        window.scroll(0,0)
      })

      let selected_element = null

      if (Array.isArray(element)){
        for (var i = 0; i < element.length; i++){
          var el = await page.$(element[i])
          if (el != null){
            selected_element = element[i]
            break
          }
        }
      } else {
        var el = await page.$(element)}
        selected_element = element
      if (el == null){
        res.status(500).json({
          message: 'No given elements matches the selector.'
        })
        return
      }
      
      page.addStyleTag({ 'content': `${selected_element} {z-index: 99999999999999999999999999999}` })
      
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
          type: 'jpeg', quality: 90, encoding: 'binary', clip: {
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
    } catch (e) {
      res.status(500).json({
        message: e.message,
        stack: e.stack
      })
    } finally {
      await page.close()
    }
  })
  app.post('/section_screenshot', async (req, res) => {
    let width = ~~req.body.width || 1920
    let height = ~~req.body.height || 1080
    let section = req.body.section
    let content = req.body.content
    let url = req.body.url
    const page = await browser.newPage();
    try {
      await page.setViewport({
        width,
        height
      })
      if (content) {
        await page.setContent(content, { waitUntil: 'networkidle2' });
      } else if (url) {
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36')
        await page.goto(url, { waitUntil: "networkidle2" })
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
        const new_parentNode = sec.parentNode.cloneNode()
        const pparentNode = sec.parentNode.parentNode
        pparentNode.removeChild(sec.parentNode)
        pparentNode.appendChild(new_parentNode)
        new_parentNode.appendChild(nbox)
        const sitenotice = document.querySelector('.sitenotice--visible') // :rina:
        if (sitenotice != null){
          sitenotice.style = 'display: none'}
        const top_ads = document.querySelector('.top-ads-container') // :rina: :rina:
        if (top_ads != null){
          top_ads.style = 'display: none'}
        document.querySelectorAll('*').forEach(element => {
          element.parentNode.replaceChild(element.cloneNode(true), element);
        });
        window.scroll(0,0)
      }, section)


      const el = await page.$('.bot-sectionbox')
      if (el == null){
        res.status(500).json({
          message: 'No given elements matches the selector.'
        })
        return
      }
      page.addStyleTag({ 'content': `.mw-parser-output {z-index: 99999999999999999999999999999}` })
      const contentSize = await (await page.$('.mw-parser-output')).boundingBox()

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
          type: 'jpeg', quality: 90, encoding: 'binary', clip: {
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
    } catch (e) {
      res.status(500).json({
        message: e.message,
        stack: e.stack
      })
    } finally {
      await page.close()
    }
  })
  app.get('/source', async (req, res) => {
    const page = await browser.newPage();
    try {
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
    } finally {
      await page.close()
    }
  })
  const server = app.listen(~~process.env.FC_SERVER_PORT || 15551)
  server.timeout = 0
  server.keepAliveTimeout = 0
})()
