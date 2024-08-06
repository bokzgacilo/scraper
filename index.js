const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const cors = require('cors')
const axios = require('axios')
const path = require('path')
const XLSX = require('xlsx-style')

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors())
app.use('/', express.static(path.join(__dirname, 'dist')));

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

app.post('/api/excel', (req, res) => {
  let json_data = req.body.excel;
  
  const workbook = { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } };
  const worksheet = workbook.Sheets['Sheet1'];
  const headers = ["Target", "Robots", "Wordpress", "Shopify", "Facebook Pixel", "Google Analytics", "Klaviyo", "Using PHP"];
  headers.forEach((header, colIndex) => {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    worksheet[cellAddress] = { v: header, s: { font: { bold: true } } };
  });

  json_data.forEach((item, rowIndex) => {
    const row = rowIndex + 1;
  
    const targetCell = XLSX.utils.encode_cell({ r: row, c: 0 });
    worksheet[targetCell] = { v: item.target };
  
    // Findings
    item.findings.forEach((finding, colIndex) => {
      const findingCellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex + 1 });
      worksheet[findingCellAddress] = {
        v: finding ? 'True' : 'False',
        s: {
        
        }
      };
    });
  });

  // Define the worksheet range
  worksheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: json_data.length, c: headers.length - 1 }
  });

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

  // Set headers and send the buffer as a downloadable file
  res.setHeader('Content-Disposition', 'attachment; filename=Exported_Results.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  
  res.send(buffer);
})

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
      const response = await fetch(`${protocol}://${target_url}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.text();

      const tempfindings = searchStrings.map(str => {
        if (str === 1) {
          return CheckWordpress(data);
        } else if (str === 4) {
          return CheckGoogleAnalytics(data);
        } else {
          return data.includes(str);
        }
      });

      let tempjson = {
        target: target_url,
        findings: tempfindings
      };

      res.send(tempjson);
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).send({ error: 'Internal Server Error' });
    }
  }
});

app.listen(3000, () => console.log("Server ready on port 3000."));

module.exports = app;