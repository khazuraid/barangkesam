const http = require('http');

const data = JSON.stringify({ email: 'admin@alkes.id', password: 'password123' });

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    const json = JSON.parse(body);
    const token = json.data.accessToken;
    console.log("Got token", token.substring(0, 10));
    
    // Now get inventaris
    http.get('http://localhost:3001/api/requests?inventaris=true', {
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res2) => {
      let body2 = '';
      res2.on('data', (d) => { body2 += d; });
      res2.on('end', () => {
        console.log("Inventaris response:", body2);
      });
    });
  });
});

req.on('error', console.error);
req.write(data);
req.end();
