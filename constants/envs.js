

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
    }
};