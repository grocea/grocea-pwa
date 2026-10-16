// Final-output precache: identity includes every selected file and worker logic.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
export async function buildServiceWorker(directory = 'dist') {
 const root=resolve(directory)
 const publicPaths=['/index.html','/manifest.webmanifest','/brand/grocea-icon.png','/pwa-192.png','/pwa-512.png','/apple-touch-icon.png','/icons.svg',...['pantry','recipe','shopping','activity'].map(x=>`/images/welcome/${x}.png`)]
 const assets=(await readdir(`${root}/assets`)).filter(x=>/\.(js|css|woff2?|png|svg|webp|jpg)$/.test(x)).map(x=>`/assets/${x}`)
 const paths=[...publicPaths,...assets].sort()
 const template=await readFile(new URL('./service-worker.template.js',import.meta.url),'utf8')
 const hash=createHash('sha256').update(template)
 for(const path of paths){hash.update(path);hash.update(path==='/index.html' ? (await readFile(root+path,'utf8')).replace(/<meta name="grocea-build" content="[^"]+" \/>/g,'') : await readFile(root+path))}
 const id=hash.digest('hex').slice(0,24)
 const html=(await readFile(root+'/index.html','utf8')).replace(/<meta name="grocea-build" content="[^"]+" \/>/g,'')
 await writeFile(root+'/index.html',html.replace('</head>',`<meta name="grocea-build" content="${id}" /></head>`))
 const digests={}
 for(const path of paths) digests[path]=createHash('sha256').update(await readFile(root+path)).digest('hex')
 await writeFile(root+'/sw.js',template.replace('__BUILD_ID__',JSON.stringify(id)).replace('__PRECACHE__',JSON.stringify(paths)).replace('__DIGESTS__',JSON.stringify(digests)))
 console.log(`Grocea shell ${id}: ${paths.length} public files`)
 return id
}
if(process.argv[1]===new URL(import.meta.url).pathname) await buildServiceWorker(process.argv[2])
