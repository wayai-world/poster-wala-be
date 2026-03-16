

exports.envs = {
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL,
    jwtExpireIn: process.env.JWT_EXPIRIR_IN,
    jwtSecretKey: process.env.JWT_SECRET_KEY,
    nodeEnv: process.env.NODE_ENV,
    allowOrigins: process.env.ALLOW_ORIGINS.split(","), // support multiple origins
    aws: {
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        s3Bucket: process.env.AWS_S3_BUCKET,
        s3PublicUrlBase: process.env.AWS_S3_PUBLIC_URL_BASE
    },
    firebase: {
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URL,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
        universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
    }
};