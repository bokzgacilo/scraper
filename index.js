const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const cors = require('cors')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors())

// app.use(express.static(path.join(__dirname, './dist')));

const searchStrings = [
  '_Incapsula_Resource',
  1,
  'cdn.shopify.com',
  "fbq('track'",
  4,
  'static.klaviyo.com',
  '.php'
];

function CheckWordpress(fileContent){
  let wpress = ['wp-admin', 'wp-content', 'wp-asset', 'wp-includes']
  let checker = wpress.some(word => fileContent.includes(word));
  return checker;
}

function CheckGoogleAnalytics(fileContent){
  let ganalytics = ['www.googletagmanager.com', 'analytics_googleanalytics', 'google_analytics']
  let checker = ganalytics.some(word => fileContent.includes(word));
  return checker;
}

// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, './dist', 'index.html'));
// })

// Checking HTTP or HTTPS
async function checkProtocol(url) {
  try {
    const httpsUrl = `https://${url}`;
    await axios.get(httpsUrl);
    return 'https';
  } catch (httpsError) {
    try {
      const httpUrl = `http://${url}`;
      await axios.get(httpUrl);
      return 'http';
    } catch (httpError) {
      return 'unknown';
    }
  }
}

app.get('/temp/*', (req, res) => {
  const filePath = path.join(__dirname, 'temp', req.params[0]);
  res.sendFile(filePath);
});

app.get('/api/test', (req, res) => {
  res.send('endpoints working');
})

app.post('/api/check', async (req, res) => {
  const target_url = req.body.target;

  const protocol = await checkProtocol(target_url);

  if (protocol === 'unknown') {
    res.status(404).send('404');
  } else {
    try {
      const response = await axios.get(`${protocol}://${target_url}`);
      const filePath = path.join(__dirname, '/temp/page_source.txt');
      fs.writeFileSync(filePath, response.data, 'utf8');
      const fileContent = fs.readFileSync(filePath, 'utf8');

      const results = searchStrings.reduce((acc, str, index) => {
        if(str === 1){
          acc[1] = CheckWordpress(fileContent)
        }else if(str === 4){
          acc[4] = CheckGoogleAnalytics(fileContent)
        } else {
          acc[index] = fileContent.includes(str);
        }

        return acc;
      }, {});

      res.send(results);
    } catch (error) {
      console.error('Error fetching the website:', error);
      res.status(500).send('Error fetching the website');
    }
  }
});

app.listen(3000, () => console.log("Server ready on port 3000."));

module.exports = app;