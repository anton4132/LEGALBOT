import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Jedi API',
            version: '1.0.0',
            description: 'API for managing Jedi',
            contact: {
                name: 'IDW'
            },
            servers: [
                {
                    url: 'http://localhost:3000',
                    description: 'Local server'
                }
            ]
        }
    },
    apis: ['./routes/*.js']
};

const specs = swaggerJsdoc(options);
export default specs;