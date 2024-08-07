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
  'wp-content',
  'wp-admin',
  'wp-json',
  'wp-json/wp/v2/',
  'react',
  'angular',
  'vue',
  'helmet'
];

function ReactChecker(fileContent){
  let wpress = ['_next', 'data-reactroot', 'data-reactid']
  // let wpress = ['.php']  
  let checker = wpress.some(word => fileContent.includes(word));
  return checker;
}

// Checking HTTP or HTTPS
async function checkProtocol(url) {
  // try {
  //   const httpsUrl = `https://${url}`;
  //   await axios.get(httpsUrl);
  //   return 'https';
  // } catch (httpsError) {
  //   try {
  //     const httpUrl = `http://${url}`;
  //     await axios.get(httpUrl);
  //     return 'http';
  //   } catch (httpError) {
  //     return 'unknown';
  //   }
  // }
}

app.post('/api/excel', (req, res) => {
  let json_data = req.body.excel;
  
  const workbook = { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } };
  const worksheet = workbook.Sheets['Sheet1'];
  const headers = ["Target", "wp-content", "wp-admin", "wp-json", "wp-json/wp/v2/", "react", "angular", "vue", "helmet"];
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
        v: finding ? 'x' : '',
        s: {}
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

function stripPrefix(url) {
  const prefixes = ['www.', 'checkout.', 'store.'];

  for (let prefix of prefixes) {
    if (url.startsWith(prefix)) {
      return url.substring(prefix.length);
    }
  }
  return url;
}



app.post('/api/check', async (req, res) => {
  const target_url = req.body.target;
  console.log('API CHECK : ' + target_url)

  try {
    const response = await fetch("http://" + target_url);
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
    const urlencoded = new URLSearchParams();
    
    let strippedWWW = stripPrefix(target_url)
    let frameworks = []

    urlencoded.append("data", `{\"rawhostname\":\"${strippedWWW}\",\"hostname\":\"${strippedWWW}\",\"url\":\"https://${target_url}\",\"encode\":true}`);
    
    await fetch("https://www.whatruns.com/api/v1/get_site_apps", {
      method: "POST",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow"
    })
      .then((response) => response.json())
      .then(result => {
        let json_result = JSON.parse(result.apps)
        let dynamic_id = Object.keys(json_result)
        frameworks = json_result[dynamic_id]['Javascript Frameworks']
      })
      .catch((error) => console.error(error));
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.text();
    let tempfindings = []
    
    searchStrings.map((str, idx) => {
      if(str === 'react'){
        let exists = frameworks.some(framework => framework.name === "React");
        tempfindings[idx] = exists
      }else if(str === 'angular'){
        let exists = frameworks.some(framework => framework.name === "Angular JS");
        tempfindings[idx] = exists
      }else if(str === 'vue'){
        let exists = frameworks.some(framework => framework.name === "Vue JS");
        tempfindings[idx] = exists
      }else {
        tempfindings[idx] = data.includes(str);
      }
    });

    let tempjson = {
      target: target_url,
      findings: tempfindings
    };

    res.send(tempjson);
  } catch (error) {
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

app.listen(3000, () => console.log("Server ready on port 3000."));

module.exports = app;