const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LegalBot API',
      version: '1.0.0',
      description: 'API for managing LegalBot resources',
      contact: {
        name: 'LegalBot Team'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Local server'
      }
    ]
  },
  apis: [path.join(__dirname, '../src/routes/*.js')]
};

const specs = swaggerJsdoc(options);
module.exports = specs;