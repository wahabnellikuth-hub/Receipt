const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');
c = c.replace(/\\\$\{App\.t/g, '${App.t');
fs.writeFileSync('js/app.js', c);
