import https from 'https';

const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=FC4F9937-A594-3874-AF91-F183CC90F5AA&domain=ais-dev-5ilqa6hzempns6ktnohlfa-348818218943.asia-northeast1.run.app&crs=EPSG:4326&format=json&geomFilter=POINT(126.710658534781%2037.4872667315126)');

const options = {
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
};

const req = https.request(url, options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`BODY: ${data.substring(0, 200)}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
