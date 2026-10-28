import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
await fs.mkdir('docs/screenshots',{recursive:true});
await page.goto('http://127.0.0.1:5193/',{waitUntil:'networkidle2'});
await page.screenshot({path:'docs/screenshots/search.png'});
await page.evaluate(()=>localStorage.setItem('agrofuel.v1.selection',JSON.stringify({region:'Краснодарский край',fuel:'diesel'})));
for (const route of ['market','stations','compare','planning']) {
 await page.goto('http://127.0.0.1:5193/#/'+route,{waitUntil:'networkidle2'});await page.reload({waitUntil:'networkidle2'});
 await new Promise(r=>setTimeout(r,12000));await page.screenshot({path:'docs/screenshots/'+route+'.png',fullPage:route==='market'});
 console.log(route, await page.title(),await page.locator('h1').map(e=>e.textContent).wait());
}
await page.setViewport({width:390,height:844,deviceScaleFactor:1});await page.goto('http://127.0.0.1:5193/#/market',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));await page.screenshot({path:'docs/screenshots/mobile.png',fullPage:true});
console.log('mobile width',await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth})));
await browser.close();
