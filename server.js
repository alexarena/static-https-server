const https = require('https'),
    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    exec = require('child_process').exec

function cmd(command){
  return new Promise((resolve,reject)=>{
    exec(command,(err,out)=>{
      if(err) reject(err)
      resolve(out)
    })
  })
}

function exists(pathname){
  return new Promise((resolve,reject)=>{
    fs.exists(pathname, (exist)=>{
      resolve(exist)
    })
  })
}

const port = parseInt(process.argv[2]) || 9000

const server = async (req,res) => {
  console.log(`${req.method} ${req.url}`)

  const parsedUrl = url.parse(req.url)
  let pathname = `.${parsedUrl.pathname}`
  const ext = path.parse(pathname).ext || '.html'

  const mime = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword'
  }

  const doesExist = await exists(pathname)
  if(!doesExist) {
    res.statusCode = 404
    res.end(`File ${pathname} not found`)
    return
  }

  if (fs.statSync(pathname).isDirectory()) pathname += 'index' + ext

  fs.readFile(pathname, (err, data)=>{
    if(err){
      res.statusCode = 500
      res.end(`Error getting the file: ${err}.`)
    }
    else {
      res.setHeader('Content-type', mime[ext] || 'text/plain' )
      res.end(data)
    }
  })
}

async function run(){

  let dir = await cmd('npm root -g')
  dir = dir.trim() + '/simple-https-server/certs'

  let key,cert,ca = null
  let genCerts = false
  try{
    key = fs.readFileSync(`${dir}/server.key`)
    cert = fs.readFileSync(`${dir}/server.crt`)
    ca = fs.readFileSync(`${dir}/ca.crt`)
    const willExpire = await cmd(`openssl x509 -checkend 86400 -in ${dir}/ca.crt`)

    willExpire.includes('not') ? genCerts=false : genCerts = true
  }
  catch(e){
    console.log('No certificate files found.')
    genCerts = true
  }

  if(genCerts){
    console.log(`Generating certificate files.`)
    await cmd(`openssl genrsa -out ${dir}/ca.key 1024`) // gen CA key
    await cmd(`openssl req -batch -new -key ${dir}/ca.key -out ${dir}/ca.csr -config ${dir}/config.txt`) // gen CSR
    await cmd(`openssl x509 -req -days 2 -in ${dir}/ca.csr -out ${dir}/ca.crt -signkey ${dir}/ca.key`) // sign

    await cmd(`openssl genrsa -out ${dir}/server.key 1024`) // gen CA key
    await cmd(`openssl req -batch -new -key ${dir}/server.key -out ${dir}/server.csr -config ${dir}/config.txt`) // gen CSR
    await cmd(`openssl x509 -req -days 2 -in ${dir}/server.csr -signkey ${dir}/server.key -out ${dir}/server.crt`) // sign
  }
  else{
    console.log('Using existing certificate files.')
  }

  const opts = {
    key: key || fs.readFileSync(`${dir}/server.key`),
    cert: cert || fs.readFileSync(`${dir}/server.crt`),
    ca: ca || fs.readFileSync(`${dir}/ca.crt`),
    requestCert: false,
    rejectUnauthorized: false
  }


  https.createServer(opts,server).listen(port)
  console.log(`Server listening on port ${port}`)

}

run()
