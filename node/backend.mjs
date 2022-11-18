import * as fs from 'node:fs/promises';
import * as http from 'node:http';

const port = 3000;

const teams = await fs.readFile('teams.json').catch(e => ({a:'ahoj'}));

http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', 'https://kmlinux.fjfi.cvut.cz');
  res.end(JSON.stringify(teams));
}).listen(port, () => console.log(`Server open at ${port}`));
