const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const cors = require('cors')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js');

// Replace with your Supabase URL and API Key
const supabaseUrl = 'https://uisdawrhjqvaxghevdbf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpc2Rhd3JoanF2YXhnaGV2ZGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTg2NzcxMjEsImV4cCI6MjAzNDI1MzEyMX0.u142JAUJOp2qja7haCmilVMmTWVz0-8NeQ0pM1FG73I';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors())

app.use('/temp', express.static(path.join(__dirname, 'temp')));

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

      // UPDATING TEXT
      try {
        const { error } = await supabase.storage.from('temp').upload('public/file.txt', Buffer.from(response.data, 'utf-8'), {
          contentType: 'text/plain',
          upsert: true // Ensure the file is overwritten if it exists
        });
      }catch(error){
        console.log('Error reading file: ' + error.message);
      }

      // Reading TEXT
      try {
        let {data, error} = await supabase.storage.from('temp').download('public/file.txt');
        if(error) throw error;
    
        let content = await data.text();

        let results = searchStrings.reduce((acc, str, index) => {
          if(str === 1){
            acc[1] = CheckWordpress(content)
          }else if(str === 4){
            acc[4] = CheckGoogleAnalytics(content)
          } else {
            acc[index] = content.includes(str);
          }
          return acc;
        }, {});
        
        res.send(results)
      }catch(error){
        console.log('Error reading file: ' + error.message);
      }
    } catch (error) {
      console.error('Error fetching the website:', error);
      res.status(500).send('Error fetching the website');
    }
  }
});

app.listen(3000, () => console.log("Server ready on port 3000."));

module.exports = app;