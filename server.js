import pkg from 'stremio-addon-sdk';

const { serveHTTP } = pkg;

const addonInterface = require("./addon");
serveHTTP(addonInterface, { port: 7000 });